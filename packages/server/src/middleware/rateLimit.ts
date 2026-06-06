import type { Request, Response, NextFunction } from 'express';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { logger } from '../utils/logger.js';

/**
 * 内存限流存储
 *
 * 使用滑动窗口算法，记录每个 IP 在时间窗口内的请求时间戳。
 * 生产环境建议替换为 Redis 存储（express-rate-limit + rate-limit-redis）。
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
  /** 自定义 key 生成函数（默认使用 IP） */
  keyGenerator?: (req: Request) => string;
  /** 跳过限流的条件判断 */
  skip?: (req: Request) => boolean;
}

// 全局存储 Map，定期清理过期条目
const store = new Map<string, RateLimitEntry>();

// 每 60 秒清理一次过期条目
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupStore(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * 限流中间件工厂函数
 *
 * @example
 *   // 全局限流：15 分钟内最多 100 次
 *   app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
 *
 *   // 上传限流：1 分钟内最多 10 次
 *   router.post('/upload', rateLimit({ windowMs: 60_000, max: 10 }), uploadHandler);
 *
 *   // 短信限流：60 秒内最多 1 次
 *   router.post('/sms/send', rateLimit({ windowMs: 60_000, max: 1 }), smsHandler);
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, keyGenerator, skip } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // 跳过条件判断
    if (skip?.(req)) {
      next();
      return;
    }

    // 定期清理
    cleanupStore(windowMs);

    const key = keyGenerator ? keyGenerator(req) : req.ip || req.socket.remoteAddress || 'unknown';

    const now = Date.now();
    let entry = store.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // 移除窗口外的记录
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    // 判断是否超限
    if (entry.timestamps.length >= max) {
      const oldestTimestamp = entry.timestamps[0];
      // 修正: oldestTimestamp 可能在窗口边界
      const retryAfterSec = oldestTimestamp
        ? Math.ceil((oldestTimestamp + windowMs - now) / 1000)
        : Math.ceil(windowMs / 1000);

      logger.warn(
        { ip: key, path: req.path, method: req.method },
        `Rate limit exceeded (${max} per ${windowMs / 1000}s)`
      );

      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + retryAfterSec * 1000) / 1000)));

      const response: ApiResponse<null> = {
        code: ErrorCodes.RATE_LIMITED,
        message: `请求过于频繁，请 ${retryAfterSec} 秒后再试`,
        data: null,
      };
      res.status(429).json(response);
      return;
    }

    // 记录本次请求
    entry.timestamps.push(now);

    // 设置限流信息响应头
    const remaining = max - entry.timestamps.length;
    const resetTime = entry.timestamps[0] + windowMs;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    next();
  };
}

// ========== 预置限流器 ==========

/** 全局限流：15 分钟内最多 300 次 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

/** 上传限流：1 分钟内最多 10 次 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

/** 短信发送限流：60 秒内最多 1 次 */
export const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => {
    // 按 IP + 手机号限流
    return `${req.ip}_${req.body.phone || ''}`;
  },
});

/** 创建任务限流：1 分钟内最多 20 次 */
export const createTaskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});
