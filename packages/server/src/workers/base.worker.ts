import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '../config/database.js';
import { bullConnection } from '../config/queues.js';
import { TaskStatus, PointsTransactionType } from '@fileshift/shared';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

// 任务数据类型
export interface TaskJobData {
  taskId: string;
  userId: string;
  toolId: string;
  inputFilePath: string;
  outputDir: string;
  params: Record<string, unknown>;
  pointsConsumed: number;
}

// 处理器函数类型
export type ProcessorFn = (data: TaskJobData) => Promise<string>;

/**
 * 创建通用 Worker
 * 封装任务状态更新、错误处理、积分退还等通用逻辑
 */
export function createWorker(
  queueName: string,
  processors: Record<string, ProcessorFn>,
  options?: { concurrency?: number }
): Worker {
  const worker = new Worker<TaskJobData>(
    queueName,
    async (job: Job<TaskJobData>) => {
      const {
        taskId,
        toolId,
        inputFilePath,
        outputDir: _outputDir,
        params: _params,
        pointsConsumed,
      } = job.data;

      logger.info({ taskId, toolId, jobId: job.id }, 'Processing task');

      // 1. 更新状态为处理中
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
          progress: 10,
          queueJobId: job.id,
        },
      });

      try {
        // 2. 根据 toolId 查找对应的处理器
        const processor = processors[toolId];
        if (!processor) {
          throw new Error(`No processor found for tool: ${toolId}`);
        }

        // 3. 更新进度为处理中
        await prisma.task.update({
          where: { id: taskId },
          data: { progress: 30 },
        });

        // 4. 执行处理器
        const outputPath = await processor(job.data);

        // 5. 更新进度为完成前
        await prisma.task.update({
          where: { id: taskId },
          data: { progress: 90 },
        });

        // 6. 保存输出文件记录
        const outputFile = await prisma.file.create({
          data: {
            userId: job.data.userId,
            originalName: `${path.basename(inputFilePath, path.extname(inputFilePath))}_output${path.extname(outputPath)}`,
            storedName: path.basename(outputPath),
            mimeType: getMimeTypeByExtension(path.extname(outputPath)),
            size: fs.statSync(outputPath).size,
            storagePath: outputPath,
            fileType: 'OUTPUT',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
          },
        });

        // 7. 更新任务状态为完成
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.COMPLETED,
            outputFileId: outputFile.id,
            completedAt: new Date(),
            progress: 100,
          },
        });

        logger.info({ taskId, outputPath }, 'Task completed successfully');

        return { outputPath };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        logger.error({ taskId, toolId, error: errorMessage }, 'Task failed');

        // 更新任务状态为失败
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.FAILED,
            errorMessage,
            completedAt: new Date(),
            progress: 0,
          },
        });

        // 退还积分（仅退还一次）
        if (pointsConsumed > 0) {
          const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { pointsRefunded: true },
          });

          if (task && !task.pointsRefunded) {
            await refundPoints(job.data.userId, pointsConsumed, taskId);
            await prisma.task.update({
              where: { id: taskId },
              data: { pointsRefunded: true },
            });
          }
        }

        // 清理输入文件
        await safeUnlink(inputFilePath);

        throw error; // 让 BullMQ 记录失败
      }
    },
    {
      connection: bullConnection as ConnectionOptions,
      concurrency: options?.concurrency || 3,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: queueName }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: queueName, error: err.message }, 'Job failed');
  });

  return worker;
}

/**
 * 退还积分
 */
async function refundPoints(userId: string, amount: number, taskId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // 增加积分
      const user = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: amount } },
        select: { points: true },
      });

      // 写入退还流水
      await tx.pointsTransaction.create({
        data: {
          userId,
          type: PointsTransactionType.REFUND,
          amount: amount, // 正数
          balanceAfter: user.points,
          description: '任务处理失败，积分退还',
          relatedTaskId: taskId,
        },
      });
    });

    logger.info({ userId, amount, taskId }, 'Points refunded');
  } catch (error) {
    logger.error({ userId, amount, taskId, error }, 'Failed to refund points');
  }
}

/**
 * 根据扩展名获取 MIME 类型
 */
function getMimeTypeByExtension(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.flv': 'video/x-flv',
  };

  return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * 安全删除文件
 */
async function safeUnlink(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    logger.warn({ filePath, error }, 'Failed to delete file');
  }
}
