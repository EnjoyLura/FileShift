import { Worker } from 'bullmq';
import { createImageWorker } from './image.worker.js';
import { createDocumentWorker } from './document.worker.js';
import { logger } from '../utils/logger.js';

// 存储所有 Worker 实例
const workers: Worker[] = [];

/**
 * 启动所有 Worker
 */
export function startAllWorkers() {
  logger.info('Starting all workers...');

  // Image Worker（图片处理）
  const imageWorker = createImageWorker();
  workers.push(imageWorker);
  logger.info('Image Worker started (queue: file-image)');

  // Document Worker（文档处理 + Mock 测试）
  const documentWorker = createDocumentWorker();
  workers.push(documentWorker);
  logger.info('Document Worker started (queue: file-document)');

  // TODO: Step 19-21 中添加 Media Worker
  // const mediaWorker = createMediaWorker();
  // workers.push(mediaWorker);

  logger.info(`All ${workers.length} workers started`);
}

/**
 * 关闭所有 Worker
 */
export async function stopAllWorkers() {
  logger.info('Stopping all workers...');

  for (const worker of workers) {
    await worker.close();
  }

  logger.info('All workers stopped');
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down workers...');
  await stopAllWorkers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down workers...');
  await stopAllWorkers();
  process.exit(0);
});
