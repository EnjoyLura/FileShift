import { app } from './app.js';
import { logger } from './utils/logger.js';
import { registerCronJobs } from './jobs/cleanFiles.js';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  logger.info(`FileShift API server is running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);

  // 注册定时任务
  registerCronJobs();
});
