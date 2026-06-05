import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { authMiddleware } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  processFileUpload,
  getFileInfo,
  getFileForDownload,
} from '../services/file.service.js';
import path from 'path';

const router = Router();

// 所有文件操作需要登录
router.use(authMiddleware);

// ========== Zod Schemas ==========

const uploadSchema = z.object({
  toolId: z.string().optional(),
});

/**
 * POST /api/v1/files/upload - 上传文件
 */
router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    // 校验文件是否存在
    if (!req.file) {
      const response: ApiResponse<null> = {
        code: ErrorCodes.PARAM_ERROR,
        message: '请选择要上传的文件',
        data: null,
      };
      res.status(400).json(response);
      return;
    }

    // 校验参数
    const parsed = uploadSchema.safeParse(req.body);
    const toolId = parsed.success ? parsed.data.toolId : undefined;

    try {
      const result = await processFileUpload(
        req.user!.userId,
        req.file,
        toolId
      );

      const response: ApiResponse = {
        code: ErrorCodes.SUCCESS,
        message: '文件上传成功',
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof AppError) {
        const response: ApiResponse<null> = {
          code: error.code,
          message: error.message,
          data: null,
        };
        res.status(error.statusCode).json(response);
        return;
      }

      // Multer 文件大小超限错误
      if (error instanceof Error && error.message.includes('File too large')) {
        const response: ApiResponse<null> = {
          code: ErrorCodes.FILE_SIZE_EXCEEDED,
          message: '文件大小超过限制',
          data: null,
        };
        res.status(422).json(response);
        return;
      }

      throw error;
    }
  }
);

/**
 * GET /api/v1/files/:id/info - 获取文件信息
 */
router.get('/:id/info', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const info = await getFileInfo(id, req.user!.userId);

    const response: ApiResponse = {
      code: ErrorCodes.SUCCESS,
      message: 'success',
      data: info,
    };
    res.json(response);
  } catch (error) {
    if (error instanceof AppError) {
      const response: ApiResponse<null> = {
        code: error.code,
        message: error.message,
        data: null,
      };
      res.status(error.statusCode).json(response);
      return;
    }
    throw error;
  }
});

/**
 * GET /api/v1/files/:id/download - 下载文件
 */
router.get('/:id/download', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { filePath, originalName, mimeType } = await getFileForDownload(
      id,
      req.user!.userId
    );

    // 设置下载头
    const encodedName = encodeURIComponent(originalName);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedName}`
    );

    // 发送文件流
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    if (error instanceof AppError) {
      const response: ApiResponse<null> = {
        code: error.code,
        message: error.message,
        data: null,
      };
      res.status(error.statusCode).json(response);
      return;
    }
    throw error;
  }
});

export { router as fileRouter };
