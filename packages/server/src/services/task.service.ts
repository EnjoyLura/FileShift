import { prisma } from '../config/database.js';
import { getQueueByCategory } from '../config/queues.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes, TaskStatus, PointsTransactionType } from '@fileshift/shared';
import { OUTPUT_DIR } from '../middleware/upload.js';
import { logger } from '../utils/logger.js';

/**
 * 创建任务（扣积分 + 入队）
 */
export async function createTask(
  userId: string,
  toolId: string,
  inputFileId: string,
  params: Record<string, unknown> = {}
) {
  // 1. 查询工具配置
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    throw new AppError(ErrorCodes.NOT_FOUND, '工具不存在', 404);
  }

  if (!tool.enabled) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '该工具暂时不可用', 400);
  }

  // 2. 查询用户积分（带行锁防并发）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, vipType: true },
  });

  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  // 3. 计算实际消耗积分（VIP 折扣）
  let pointsCost = tool.pointsCost;
  if (user.vipType) {
    const vipPackage = await prisma.vipPackage.findFirst({
      where: { type: user.vipType },
      select: { discount: true },
    });
    if (vipPackage) {
      pointsCost = Math.ceil(tool.pointsCost * vipPackage.discount);
    }
  }

  // 4. 校验积分余额
  if (user.points < pointsCost) {
    throw new AppError(
      ErrorCodes.INSUFFICIENT_POINTS,
      `积分不足，需要 ${pointsCost} 积分，当前余额 ${user.points}`,
      422
    );
  }

  // 5. 查询输入文件
  const inputFile = await prisma.file.findUnique({
    where: { id: inputFileId },
  });

  if (!inputFile) {
    throw new AppError(ErrorCodes.NOT_FOUND, '输入文件不存在', 404);
  }

  if (inputFile.userId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, '无权使用此文件', 403);
  }

  // 6. 事务：扣积分 + 创建任务记录
  const task = await prisma.$transaction(async (tx) => {
    // 扣除积分
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { points: { decrement: pointsCost } },
      select: { points: true },
    });

    // 写入积分流水
    await tx.pointsTransaction.create({
      data: {
        userId,
        type: PointsTransactionType.CONSUME,
        amount: -pointsCost, // 负数表示消耗
        balanceAfter: updatedUser.points,
        description: `使用工具: ${tool.name}`,
      },
    });

    // 创建任务记录
    const newTask = await tx.task.create({
      data: {
        userId,
        toolId,
        inputFileId,
        params: params as never,
        pointsConsumed: pointsCost,
        status: TaskStatus.PENDING,
      },
    });

    return newTask;
  });

  // 7. 将任务入队
  const queue = getQueueByCategory(tool.category);
  const job = await queue.add('process', {
    taskId: task.id,
    userId,
    toolId,
    inputFilePath: inputFile.storagePath,
    outputDir: OUTPUT_DIR,
    params,
    pointsConsumed: pointsCost,
  });

  // 8. 更新任务记录的队列 ID
  await prisma.task.update({
    where: { id: task.id },
    data: { queueJobId: job.id },
  });

  logger.info(
    { taskId: task.id, toolId, userId, pointsCost, jobId: job.id },
    'Task created and enqueued'
  );

  return {
    taskId: task.id,
    status: task.status,
    pointsConsumed: pointsCost,
    estimatedTime: 30, // 预估处理时间（秒）
  };
}

/**
 * 查询任务详情
 */
export async function getTaskDetail(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      tool: { select: { id: true, name: true, category: true } },
      inputFile: {
        select: { id: true, originalName: true, size: true, mimeType: true },
      },
      outputFile: {
        select: { id: true, originalName: true, size: true, mimeType: true },
      },
    },
  });

  if (!task) {
    throw new AppError(ErrorCodes.NOT_FOUND, '任务不存在', 404);
  }

  if (task.userId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, '无权查看此任务', 403);
  }

  return {
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    tool: task.tool,
    inputFile: task.inputFile,
    outputFile: task.outputFile
      ? {
          fileId: task.outputFile.id,
          originalName: task.outputFile.originalName,
          size: task.outputFile.size,
          downloadUrl: `/api/v1/files/${task.outputFile.id}/download`,
        }
      : null,
    pointsConsumed: task.pointsConsumed,
    pointsRefunded: task.pointsRefunded,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
  };
}

/**
 * 查询任务列表（分页）
 */
export async function getTaskList(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  status?: string
) {
  const where: Record<string, unknown> = { userId };
  if (status) {
    where.status = status;
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        tool: { select: { id: true, name: true, category: true } },
        inputFile: { select: { originalName: true, mimeType: true } },
        outputFile: { select: { id: true, originalName: true, size: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    list: tasks.map((task) => ({
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      tool: task.tool,
      inputFileName: task.inputFile.originalName,
      outputFile: task.outputFile
        ? {
            fileId: task.outputFile.id,
            originalName: task.outputFile.originalName,
            size: task.outputFile.size,
            downloadUrl: `/api/v1/files/${task.outputFile.id}/download`,
          }
        : null,
      pointsConsumed: task.pointsConsumed,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    })),
    total,
    page,
    pageSize,
  };
}
