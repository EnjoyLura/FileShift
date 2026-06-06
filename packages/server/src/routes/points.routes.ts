import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { z } from 'zod';
import { ErrorCodes, PointsTransactionType, type ApiResponse } from '@fileshift/shared';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getPointsBalance,
  getPointsTransactions,
  getPointsPackages,
  getVipPackages,
  signIn,
  getInviteInfo,
} from '../services/points.service.js';

const router: RouterType = Router();

// ========== Zod Schemas ==========

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  type: z.nativeEnum(PointsTransactionType).optional(),
});

// ========== 积分余额 ==========

/**
 * GET /api/v1/points/balance - 查询积分余额
 */
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getPointsBalance(req.user!.userId);

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

// ========== 积分流水 ==========

/**
 * GET /api/v1/points/transactions - 查询积分流水
 */
router.get('/transactions', authMiddleware, async (req: Request, res: Response) => {
  const parsed = paginationSchema.safeParse(req.query);
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
    const result = await getPointsTransactions(
      req.user!.userId,
      parsed.data.page,
      parsed.data.pageSize,
      parsed.data.type
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

// ========== 积分套餐 ==========

/**
 * GET /api/v1/points/packages - 查询积分套餐
 */
router.get('/packages', async (_req: Request, res: Response) => {
  try {
    const result = await getPointsPackages();

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
 * GET /api/v1/points/vip-packages - 查询 VIP 套餐
 */
router.get('/vip-packages', async (_req: Request, res: Response) => {
  try {
    const result = await getVipPackages();

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

// ========== 每日签到 ==========

/**
 * POST /api/v1/points/sign-in - 每日签到
 */
router.post('/sign-in', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await signIn(req.user!.userId);

    const response: ApiResponse = {
      code: ErrorCodes.SUCCESS,
      message:
        result.bonusEarned > 0
          ? `签到成功！获得 ${result.pointsEarned} 积分（连续${result.consecutiveDays}天，含额外奖励${result.bonusEarned}积分）`
          : `签到成功！获得 ${result.pointsEarned} 积分（连续${result.consecutiveDays}天）`,
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

// ========== 邀请好友 ==========

/**
 * GET /api/v1/points/invite - 获取邀请信息
 */
router.get('/invite', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getInviteInfo(req.user!.userId);

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

export { router as pointsRouter };
