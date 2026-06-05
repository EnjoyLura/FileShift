// Worker 进程入口
// 独立于 API 服务器运行，专门处理异步任务
import 'dotenv/config';
import { startAllWorkers } from './workers/index.js';
import { logger } from './utils/logger.js';

logger.info('FileShift Worker process starting...');

// 启动所有 Worker
startAllWorkers();

logger.info('Worker process is ready and listening for tasks');
