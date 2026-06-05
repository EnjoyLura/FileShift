import { Router } from 'express';
import type { Request, Response } from 'express';
import { ErrorCodes, ALL_TOOLS, type ApiResponse, type ToolCategory } from '@fileshift/shared';
import { testConnection } from '../config/database.js';
import { testRedisConnection } from '../config/redis.js';
import { authRouter } from './auth.routes.js';

const router = Router();

// ========== 公开路由 ==========

// 健康检查（含数据库 + Redis 连接检测）
router.get('/health', async (_req: Request, res: Response) => {
  const [dbConnected, redisConnected] = await Promise.all([
    testConnection(),
    testRedisConnection(),
  ]);

  const allHealthy = dbConnected && redisConnected;

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: allHealthy ? 'ok' : 'some services unavailable',
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
    },
  };
  res.status(allHealthy ? 200 : 503).json(response);
});

// 获取工具列表（公开）
router.get('/v1/tools', (req: Request, res: Response) => {
  const category = req.query.category as ToolCategory | undefined;
  const keyword = req.query.keyword as string | undefined;

  let tools = ALL_TOOLS;

  if (category) {
    tools = tools.filter((t) => t.category === category);
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        t.description.toLowerCase().includes(kw) ||
        t.id.toLowerCase().includes(kw)
    );
  }

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'success',
    data: tools,
  };
  res.json(response);
});

// ========== 认证路由 ==========

// 认证相关：/api/v1/auth/*
router.use('/v1/auth', authRouter);

// 用户相关（复用 authRouter 中的认证路由）：/api/v1/user/*
router.use('/v1/user', authRouter);

export { router as apiRouter };
