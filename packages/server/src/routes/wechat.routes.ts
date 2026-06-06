import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { z } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import {
  generateAuthUrl,
  handleCallback,
  checkPollStatus,
} from '../services/wechat.service.js';

const router: RouterType = Router();

// ========== Zod Schemas ==========

const authUrlSchema = z.object({
  mode: z.enum(['pc', 'mobile']).optional().default('pc'),
});

const callbackSchema = z.object({
  code: z.string().min(1, '缺少授权码'),
  state: z.string().min(1, '缺少状态参数'),
});

const pollSchema = z.object({
  pollId: z.string().min(1, '缺少轮询ID'),
});

// ========== 微信认证路由 ==========

/**
 * GET /api/v1/auth/wechat/url - 获取微信授权 URL
 *
 * PC端: 返回 URL 和 pollId，前端用 URL 生成二维码，用 pollId 轮询登录状态
 * 移动端: 返回 URL，前端直接跳转
 */
router.get('/url', async (req: Request, res: Response) => {
  const parsed = authUrlSchema.safeParse(req.query);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: parsed.error.errors[0]?.message || '参数错误',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await generateAuthUrl(parsed.data.mode);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'success',
    data: result,
  };
  res.json(response);
});

/**
 * GET /api/v1/auth/wechat/callback - 微信 OAuth 回调
 *
 * 微信授权后重定向到此接口：
 * 1. 校验 state 防 CSRF
 * 2. 用 code 换 access_token + openid
 * 3. 查找/创建用户
 * 4. 签发 JWT
 * 5. 重定向到前端（携带 token 和用户信息）
 */
router.get('/callback', async (req: Request, res: Response) => {
  const parsed = callbackSchema.safeParse(req.query);
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
    const result = await handleCallback(parsed.data.code, parsed.data.state);

    // 将 token 和用户信息编码为 URL 参数，重定向到前端回调页
    const frontendUrl = new URL(
      '/auth/wechat/callback',
      process.env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:5173'
    );

    frontendUrl.searchParams.set('accessToken', result.tokens.accessToken);
    frontendUrl.searchParams.set('refreshToken', result.tokens.refreshToken);
    frontendUrl.searchParams.set('user', JSON.stringify(result.user));

    res.redirect(302, frontendUrl.toString());
  } catch (err) {
    // 重定向到前端错误页
    const frontendUrl = new URL(
      '/login?error=wechat_auth_failed',
      process.env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:5173'
    );
    res.redirect(302, frontendUrl.toString());
  }
});

/**
 * GET /api/v1/auth/wechat/poll - PC 端轮询登录状态
 *
 * 前端在展示二维码后定期轮询此接口
 * - pending: 用户尚未扫码/确认
 * - completed: 扫码登录成功，返回 token
 */
router.get('/poll', async (req: Request, res: Response) => {
  const parsed = pollSchema.safeParse(req.query);
  if (!parsed.success) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.PARAM_ERROR,
      message: '缺少轮询ID',
      data: null,
    };
    res.status(400).json(response);
    return;
  }

  const result = await checkPollStatus(parsed.data.pollId);

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'success',
    data: result,
  };
  res.json(response);
});

// ========== 微信认证路由（结束） ==========

export { router as wechatRouter };
