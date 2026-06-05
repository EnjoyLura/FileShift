import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();

// 安全头
app.use(helmet());

// CORS 配置
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// API 路由
app.use('/api', apiRouter);

// 全局错误处理
app.use(errorHandler);

export { app };
