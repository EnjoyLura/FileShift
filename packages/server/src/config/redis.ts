import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis 客户端单例
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null; // 停止重试
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true, // 延迟连接，避免启动时阻塞
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Redis 连接测试
export async function testRedisConnection(): Promise<boolean> {
  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

// ========== 验证码相关 ==========

const SMS_CODE_PREFIX = 'sms:code:';
const SMS_CODE_TTL = 600; // 10分钟
const SMS_COOLDOWN_PREFIX = 'sms:cooldown:';
const SMS_COOLDOWN_TTL = 60; // 60秒冷却

/**
 * 存储短信验证码
 */
export async function storeSmsCode(phone: string, code: string): Promise<void> {
  await redis.setex(`${SMS_CODE_PREFIX}${phone}`, SMS_CODE_TTL, code);
  await redis.setex(`${SMS_COOLDOWN_PREFIX}${phone}`, SMS_COOLDOWN_TTL, '1');
}

/**
 * 校验短信验证码
 */
export async function verifySmsCode(phone: string, code: string): Promise<boolean> {
  const storedCode = await redis.get(`${SMS_CODE_PREFIX}${phone}`);
  if (!storedCode || storedCode !== code) {
    return false;
  }
  // 验证成功后删除
  await redis.del(`${SMS_CODE_PREFIX}${phone}`);
  return true;
}

/**
 * 检查短信发送冷却时间
 */
export async function isSmsCooldown(phone: string): Promise<boolean> {
  const exists = await redis.exists(`${SMS_COOLDOWN_PREFIX}${phone}`);
  return exists === 1;
}

// ========== Refresh Token 黑名单 ==========

const REFRESH_BLACKLIST_PREFIX = 'refresh:blacklist:';

/**
 * 将 Refresh Token 加入黑名单（用于登出）
 */
export async function blacklistRefreshToken(token: string, ttlSeconds: number): Promise<void> {
  await redis.setex(`${REFRESH_BLACKLIST_PREFIX}${token}`, ttlSeconds, '1');
}

/**
 * 检查 Refresh Token 是否在黑名单中
 */
export async function isRefreshTokenBlacklisted(token: string): Promise<boolean> {
  const exists = await redis.exists(`${REFRESH_BLACKLIST_PREFIX}${token}`);
  return exists === 1;
}
