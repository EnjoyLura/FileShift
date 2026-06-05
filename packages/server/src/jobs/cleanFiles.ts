import cron from 'node-cron';
import { cleanExpiredFiles } from '../services/file.service.js';
import { logger } from '../utils/logger.js';

/**
 * 注册定时任务
 * - 每小时清理过期文件
 */
export function registerCronJobs() {
  // 每小时执行一次文件清理
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled file cleanup...');
    try {
      const count = await cleanExpiredFiles();
      logger.info({ cleanedCount: count }, 'Scheduled file cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled file cleanup failed');
    }
  });

  logger.info('Cron jobs registered: file cleanup (hourly)');
}
