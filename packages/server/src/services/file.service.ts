import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes, FileType } from '@fileshift/shared';
import { UPLOAD_DIR, OUTPUT_DIR } from '../middleware/upload.js';
import { validateFileMimeType } from '../utils/fileValidator.js';
import { logger } from '../utils/logger.js';

/**
 * 处理文件上传（上传后校验真实类型 + 写入数据库）
 */
export async function processFileUpload(
  userId: string,
  file: Express.Multer.File,
  toolId?: string
) {
  // 1. 校验文件真实 MIME 类型
  const validation = await validateFileMimeType(file.path, file.mimetype);
  if (!validation.valid) {
    // 删除伪造文件
    await safeUnlink(file.path);
    throw new AppError(
      ErrorCodes.UNSUPPORTED_FORMAT,
      `文件类型不匹配：声明为 ${file.mimetype}，实际为 ${validation.realMime}`,
      422
    );
  }

  // 2. 如果指定了工具，校验工具支持的文件格式
  if (toolId) {
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) {
      await safeUnlink(file.path);
      throw new AppError(ErrorCodes.NOT_FOUND, '工具不存在', 404);
    }

    if (!tool.enabled) {
      await safeUnlink(file.path);
      throw new AppError(ErrorCodes.PARAM_ERROR, '该工具暂时不可用', 400);
    }

    // 校验文件大小限制
    if (file.size > tool.maxFileSize) {
      await safeUnlink(file.path);
      throw new AppError(
        ErrorCodes.FILE_SIZE_EXCEEDED,
        `文件大小超过限制（最大 ${formatBytes(tool.maxFileSize)}）`,
        422
      );
    }

    // 校验输入格式
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (tool.inputFormats.length > 0 && !tool.inputFormats.includes(ext)) {
      await safeUnlink(file.path);
      throw new AppError(
        ErrorCodes.UNSUPPORTED_FORMAT,
        `该工具不支持 ${ext.toUpperCase()} 格式，支持: ${tool.inputFormats.join(', ')}`,
        422
      );
    }
  }

  // 3. 写入文件记录
  const fileRecord = await prisma.file.create({
    data: {
      userId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: validation.realMime || file.mimetype,
      size: file.size,
      storagePath: file.path,
      fileType: FileType.INPUT,
    },
  });

  logger.info(
    { fileId: fileRecord.id, userId, size: file.size, mime: fileRecord.mimeType },
    'File uploaded successfully'
  );

  return {
    fileId: fileRecord.id,
    originalName: fileRecord.originalName,
    size: fileRecord.size,
    mimeType: fileRecord.mimeType,
  };
}

/**
 * 获取文件信息
 */
export async function getFileInfo(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new AppError(ErrorCodes.NOT_FOUND, '文件不存在', 404);
  }

  if (file.userId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, '无权访问此文件', 403);
  }

  return {
    id: file.id,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    fileType: file.fileType,
    createdAt: file.createdAt,
    expiresAt: file.expiresAt,
  };
}

/**
 * 获取文件流（用于下载）
 */
export async function getFileForDownload(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new AppError(ErrorCodes.NOT_FOUND, '文件不存在', 404);
  }

  // 输入文件只允许上传者下载，输出文件也校验用户
  if (file.userId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, '无权下载此文件', 403);
  }

  // 检查文件是否存在于磁盘
  if (!fs.existsSync(file.storagePath)) {
    throw new AppError(ErrorCodes.NOT_FOUND, '文件已过期或被清理', 404);
  }

  return {
    filePath: file.storagePath,
    originalName: file.originalName,
    mimeType: file.mimeType,
  };
}

/**
 * 清理过期文件
 */
export async function cleanExpiredFiles() {
  const now = new Date();

  // 查询所有已过期的文件
  const expiredFiles = await prisma.file.findMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  let cleanedCount = 0;

  for (const file of expiredFiles) {
    try {
      // 删除磁盘文件
      await safeUnlink(file.storagePath);
      // 删除数据库记录
      await prisma.file.delete({ where: { id: file.id } });
      cleanedCount++;
    } catch (error) {
      logger.error({ fileId: file.id, error }, 'Failed to clean expired file');
    }
  }

  // 清理没有关联任务的孤立输入文件（超过2小时）
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const orphanFiles = await prisma.file.findMany({
    where: {
      fileType: FileType.INPUT,
      createdAt: { lt: twoHoursAgo },
      inputTasks: { none: {} }, // 没有关联的任务
    },
  });

  for (const file of orphanFiles) {
    try {
      await safeUnlink(file.storagePath);
      await prisma.file.delete({ where: { id: file.id } });
      cleanedCount++;
    } catch (error) {
      logger.error({ fileId: file.id, error }, 'Failed to clean orphan file');
    }
  }

  if (cleanedCount > 0) {
    logger.info({ cleanedCount }, 'Expired/orphan files cleaned');
  }

  return cleanedCount;
}

// ========== 工具函数 ==========

async function safeUnlink(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    logger.warn({ filePath, error }, 'Failed to delete file');
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export { UPLOAD_DIR, OUTPUT_DIR };
