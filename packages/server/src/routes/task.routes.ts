import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createTask,
  getTaskDetail,
  getTaskList,
} from '../services/task.service.js';

const router = Router();

// 所有任务操作需要登录
router.use(authMiddleware);

// ========== Zod Schemas ==========

const createTaskSchema = z.object({
  toolId: z.string().min(1, '请选择工具'),
  inputFileId: z.string().min(1, '请上传文件'),
  params: z.record(z.unknown()).optional().default({}),
});

const taskListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
});

/**
 * POST /api/v1/tasks - 创建任务
 */
router.post('/', async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  try {
    const result = await createTask(
      req.user!.userId,
      parsed.data.toolId,
      parsed.data.inputFileId,
      parsed.data.params
    );

    const response: ApiResponse = {
      code: ErrorCodes.SUCCESS,
      message: `任务创建成功，已扣除 ${result.pointsConsumed} 积分`,
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
    throw error;
  }
});

/**
 * GET /api/v1/tasks - 查询任务列表
 */
router.get('/', async (req: Request, res: Response) => {
  const parsed = taskListSchema.safeParse(req.query);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  try {
    const result = await getTaskList(
      req.user!.userId,
      parsed.data.page,
      parsed.data.pageSize,
      parsed.data.status
    );

    const response: ApiResponse = {
      code: ErrorCodes.SUCCESS,
      message: 'success',
      data: result,
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
 * GET /api/v1/tasks/:id - 查询任务详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await getTaskDetail(id, req.user!.userId);

    const response: ApiResponse = {
      code: ErrorCodes.SUCCESS,
      message: 'success',
      data: result,
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

export { router as taskRouter };
