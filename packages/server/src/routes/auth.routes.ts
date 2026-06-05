import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { authMiddleware } from '../middleware/auth.js';
import {
  registerWithEmail,
  loginWithEmail,
  sendSmsCode,
  loginWithPhone,
  refreshTokens,
  logout,
  getUserProfile,
  updateUserProfile,
} from '../services/auth.service.js';

const router = Router();

// ========== Zod Schemas ==========

const emailRegisterSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少8位'),
  inviteCode: z.string().optional(),
});

const emailLoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

const smsSendSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
});

const phoneLoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码为6位数字'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '请提供刷新令牌'),
});

const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(20, '昵称长度需在2-20个字符之间').optional(),
  avatar: z.string().optional(),
});

// ========== 认证路由 ==========

/**
 * POST /api/v1/auth/register - 邮箱注册
 */
router.post('/register', async (req: Request, res: Response) => {
  const parsed = emailRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await registerWithEmail(
    parsed.data.email,
    parsed.data.password,
    parsed.data.inviteCode
  );

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '注册成功，已赠送50积分',
    data: result,
  };
  res.status(201).json(response);
});

/**
 * POST /api/v1/auth/login/email - 邮箱登录
 */
router.post('/login/email', async (req: Request, res: Response) => {
  const parsed = emailLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await loginWithEmail(parsed.data.email, parsed.data.password);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '登录成功',
    data: result,
  };
  res.json(response);
});

/**
 * POST /api/v1/auth/sms/send - 发送短信验证码
 */
router.post('/sms/send', async (req: Request, res: Response) => {
  const parsed = smsSendSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await sendSmsCode(parsed.data.phone);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: result.message,
    data: result,
  };
  res.json(response);
});

/**
 * POST /api/v1/auth/login/phone - 手机号验证码登录
 */
router.post('/login/phone', async (req: Request, res: Response) => {
  const parsed = phoneLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await loginWithPhone(parsed.data.phone, parsed.data.code);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '登录成功',
    data: result,
  };
  res.json(response);
});

/**
 * POST /api/v1/auth/token/refresh - 刷新 Token
 */
router.post('/token/refresh', async (req: Request, res: Response) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: '请提供刷新令牌',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await refreshTokens(parsed.data.refreshToken);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'Token 刷新成功',
    data: result,
  };
  res.json(response);
});

/**
 * POST /api/v1/auth/logout - 登出
 */
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await logout(refreshToken || '');

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: '登出成功',
    data: result,
  };
  res.json(response);
});

// ========== 用户信息路由（需要认证） ==========

/**
 * GET /api/v1/user/profile - 获取用户信息
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
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
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
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

export { router as authRouter };
