import { createWorker, type ProcessorFn, type TaskJobData } from './base.worker.js';
import { OUTPUT_DIR } from '../middleware/upload.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

/**
 * Mock 处理器
 * 模拟文件处理：等待3秒后"复制"输入文件为输出文件
 * 用于验证全链路（任务创建 -> 入队 -> 消费 -> 完成）
 */
const mockProcessor: ProcessorFn = async (data: TaskJobData) => {
  logger.info({ taskId: data.taskId }, 'Mock processor started');

  // 模拟处理时间
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 模拟输出：复制输入文件到输出目录
  const ext = path.extname(data.inputFilePath);
  const outputFileName = `mock_output_${Date.now()}${ext}`;
  const outputPath = path.join(data.outputDir || OUTPUT_DIR, outputFileName);

  // 确保输出目录存在
  if (!fs.existsSync(data.outputDir || OUTPUT_DIR)) {
    fs.mkdirSync(data.outputDir || OUTPUT_DIR, { recursive: true });
  }

  fs.copyFileSync(data.inputFilePath, outputPath);

  logger.info({ taskId: data.taskId, outputPath }, 'Mock processor completed');

  return outputPath;
};

// 注册所有 Mock 处理器
const mockProcessors: Record<string, ProcessorFn> = {
  'mock-tool': mockProcessor,
  'mock-convert': mockProcessor,
  'mock-compress': mockProcessor,
};

/**
 * 创建 Mock Worker
 * 用于开发和测试，验证任务队列全链路
 */
export function createMockWorker() {
  return createWorker('file-document', mockProcessors, { concurrency: 5 });
}
