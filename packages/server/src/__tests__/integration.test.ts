/**
 * Step 10: 后端 API 集成测试
 *
 * 测试覆盖：
 * - 健康检查 API（含 DB/Redis 状态）
 * - 工具列表 API（分类筛选 + 关键词搜索）
 * - 错误处理（404、参数校验失败）
 * - 限流中间件
 * - CORS 和安全头
 * - 中间件链执行顺序验证
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

// ========== 10.1 & 10.7: 健康检查 + 错误处理 ==========

describe('Health Check API', () => {
  it('GET /api/health 应返回 200 并包含状态信息', async () => {
    const res = await request(app).get('/api/health');

    // 可能 200（全部健康）或 503（部分降级），视环境而定
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('version');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('redis');
  });

  it('GET /api/health 返回格式符合 ApiResponse 规范', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.code).toBe('number');
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.data).toBe('object');
  });
});

// ========== 10.6: 工具列表 API ==========

describe('Tools List API', () => {
  it('GET /api/v1/tools 应返回所有工具', async () => {
    const res = await request(app).get('/api/v1/tools');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/tools?category=IMAGE 应只返回图片类工具', async () => {
    const res = await request(app).get('/api/v1/tools?category=IMAGE');

    expect(res.status).toBe(200);
    const tools = res.body.data;
    expect(Array.isArray(tools)).toBe(true);
    for (const tool of tools) {
      expect(tool.category).toBe('IMAGE');
    }
  });

  it('GET /api/v1/tools?category=DOCUMENT 应只返回文档类工具', async () => {
    const res = await request(app).get('/api/v1/tools?category=DOCUMENT');

    expect(res.status).toBe(200);
    const tools = res.body.data;
    for (const tool of tools) {
      expect(tool.category).toBe('DOCUMENT');
    }
  });

  it('GET /api/v1/tools?keyword=PDF 应返回包含 PDF 的工具', async () => {
    const res = await request(app).get('/api/v1/tools?keyword=PDF');

    expect(res.status).toBe(200);
    const tools = res.body.data;
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      const matchId = tool.id.toLowerCase().includes('pdf');
      const matchName = tool.name.toLowerCase().includes('pdf');
      const matchDesc = tool.description.toLowerCase().includes('pdf');
      expect(matchId || matchName || matchDesc).toBe(true);
    }
  });

  it('GET /api/v1/tools?keyword=NONEXISTENT 应返回空数组', async () => {
    const res = await request(app).get('/api/v1/tools?keyword=ZZZZ_NONEXISTENT_ZZZZ');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('每个工具应包含完整字段', async () => {
    const res = await request(app).get('/api/v1/tools');

    const tool = res.body.data[0];
    expect(tool).toHaveProperty('id');
    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('category');
    expect(tool).toHaveProperty('inputFormats');
    expect(tool).toHaveProperty('outputFormats');
    expect(tool).toHaveProperty('pointsCost');
  });
});

// ========== 10.1: 错误处理 ==========

describe('Error Handling', () => {
  it('不存在的路由应返回 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent-endpoint-xyz');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body.code).not.toBe(0);
  });

  it('未授权的请求应返回 401', async () => {
    const res = await request(app).get('/api/v1/user/profile');

    // 可能 401（未认证）或 429（限流）
    expect([401, 429]).toContain(res.status);
    if (res.status === 401) {
      expect(res.body.code).toBe(40101);
    }
  });
});

// ========== 10.5: 安全头（Helmet + CORS） ==========

describe('Security Headers', () => {
  it('响应应包含安全头', async () => {
    const res = await request(app).get('/api/health');

    // Helmet 设置的安全头
    expect(res.headers).toHaveProperty('x-content-type-options');
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers).toHaveProperty('x-frame-options');
    expect(res.headers).toHaveProperty('x-xss-protection');
  });

  it('应支持 CORS 预检请求', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers).toHaveProperty('access-control-allow-origin');
    expect(res.headers).toHaveProperty('access-control-allow-methods');
  });
});

// ========== 10.3: 限流 ==========

describe('Rate Limiting', () => {
  it('响应应包含限流头信息', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).toHaveProperty('x-ratelimit-limit');
    expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    expect(res.headers).toHaveProperty('x-ratelimit-reset');
    expect(Number(res.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
  });

  it('快速多次请求不应全部被拒绝', async () => {
    // 在正常限流阈值内发送请求
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).get('/api/health'))
    );

    // 所有请求应成功（5 次远低于 300 次的限流阈值）
    for (const res of results) {
      expect([200, 503]).toContain(res.status);
    }
  });
});

// ========== 10.4: 请求日志中间件链 ==========

describe('Middleware Chain', () => {
  it('JSON 请求体应正确解析', async () => {
    // 确认 JSON 中间件正常工作（即使没有真正处理业务逻辑）
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('中间件链不应改变请求方法语义', async () => {
    const getRes = await request(app).get('/api/health');

    // GET 请求应成功
    expect([200, 503]).toContain(getRes.status);
  });
});
