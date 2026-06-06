import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { z } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { authMiddleware } from '../middleware/auth.js';
import { getUserProfile, updateUserProfile } from '../services/auth.service.js';
import { bindWechat, unbindWechat } from '../services/wechat.service.js';

const router: RouterType = Router();

// 所有用户操作需要登录
router.use(authMiddleware);

// ========== Zod Schemas ==========

const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(20, '昵称长度需在2-20个字符之间').optional(),
  avatar: z.string().optional(),
});

const bindWechatSchema = z.object({
  code: z.string().min(1, '缺少授权码'),
});

// ========== 用户信息路由 ==========

/**
 * GET /api/v1/user/profile - 获取用户信息
 */
router.get('/profile', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const profile = await getUserProfile(userId);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'success',
    data: profile,
  };
  res.json(response);
});

/**
 * PUT /api/v1/user/profile - 更新用户信息
 */
router.put('/profile', async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const userId = req.user!.userId;
  const updated = await updateUserProfile(userId, parsed.data);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '更新成功',
    data: updated,
  };
  res.json(response);
});

/**
 * POST /api/v1/user/wechat/bind - 绑定微信
 */
router.post('/wechat/bind', async (req: Request, res: Response) => {
  const parsed = bindWechatSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const userId = req.user!.userId;
  const result = await bindWechat(userId, parsed.data.code);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '微信绑定成功',
    data: result,
  };
  res.json(response);
});

/**
 * POST /api/v1/user/wechat/unbind - 解绑微信
 */
router.post('/wechat/unbind', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await unbindWechat(userId);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '微信解绑成功',
    data: result,
  };
  res.json(response);
});

export { router as userRouter };
