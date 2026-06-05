import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt.js';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { prisma } from '../config/database.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & {
        nickname: string;
        email: string | null;
        phone: string | null;
        points: number;
      };
    }
  }
}

/**
 * Auth 中间件 - 验证 JWT Token
 * 从 Authorization: Bearer <token> 中提取并验证
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.UNAUTHORIZED,
      message: '未提供认证令牌',
      data: null,
    };
    res.status(401).json(response);
    return;
  }

  const token = authHeader.slice(7); // 去掉 "Bearer "

  try {
    const payload = verifyAccessToken(token);

    // 查询用户信息（只获取必要字段）
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        points: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      const response: ApiResponse<null> = {
        code: ErrorCodes.UNAUTHORIZED,
        message: '用户不存在或已被禁用',
        data: null,
      };
      res.status(401).json(response);
      return;
    }

    // 注入用户信息到请求对象
    req.user = {
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      points: user.points,
    };

    next();
  } catch (error) {
    const response: ApiResponse<null> = {
      code: ErrorCodes.TOKEN_EXPIRED,
      message: '认证令牌已过期，请重新登录',
      data: null,
    };
    res.status(401).json(response);
  }
}

/**
 * 可选认证中间件 - Token 存在则解析，不存在也放行
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.user = { userId: payload.userId } as typeof req.user;
    } catch {
      // Token 无效时忽略，继续处理请求
    }
  }

  next();
}
