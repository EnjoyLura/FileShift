import { Worker } from 'bullmq';
import { createMockWorker } from './mock.worker.js';
import { logger } from '../utils/logger.js';

// 存储所有 Worker 实例
const workers: Worker[] = [];

/**
 * 启动所有 Worker
 */
export function startAllWorkers() {
  logger.info('Starting all workers...');

  // Mock Worker（开发/测试用）
  const mockWorker = createMockWorker();
  workers.push(mockWorker);
  logger.info('Mock Worker started (queue: file-document)');

  // TODO: Step 5-8 中逐步添加实际 Worker
  // const imageWorker = createImageWorker();
  // workers.push(imageWorker);

  // const documentWorker = createDocumentWorker();
  // workers.push(documentWorker);

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
