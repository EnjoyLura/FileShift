// Worker 进程入口（Step 4 中完善）
import { logger } from './utils/logger.js';

logger.info('FileShift Worker process started');
logger.info('Worker queues will be registered in Step 4');

// 保持进程运行
process.on('SIGINT', () => {
  logger.info('Worker process shutting down...');
  process.exit(0);
});
