import { Queue, type ConnectionOptions } from 'bullmq';

// Redis 连接配置（BullMQ 使用独立的连接配置）
export const bullConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as unknown as number, // BullMQ 要求设为 null
};

// ========== 队列定义 ==========

/**
 * 图片处理队列
 * 格式转换、压缩、缩放等
 */
export const imageQueue = new Queue('file-image', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * 文档处理队列
 * PDF 转换、合并、拆分等
 */
export const documentQueue = new Queue('file-document', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * 音视频处理队列
 * 视频转换、压缩、提取音频等
 */
export const mediaQueue = new Queue('file-media', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ========== 队列工具函数 ==========

/**
 * 根据工具类别获取对应队列
 */
export function getQueueByCategory(category: string): Queue {
  switch (category) {
    case 'IMAGE':
      return imageQueue;
    case 'DOCUMENT':
      return documentQueue;
    case 'AUDIO':
    case 'VIDEO':
      return mediaQueue;
    default:
      // 默认使用文档队列
      return documentQueue;
  }
}

/**
 * 获取所有队列（用于 Worker 注册）
 */
export function getAllQueues(): Queue[] {
  return [imageQueue, documentQueue, mediaQueue];
}
