import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

const ACCESS_TOKEN_EXPIRES = '2h';
const REFRESH_TOKEN_EXPIRES = '30d';

export interface TokenPayload extends JwtPayload {
  userId: string;
}

/**
 * 签发 Access Token（短期，2小时）
 */
export function signAccessToken(userId: string): string {
  return jwt.sign({ userId } as TokenPayload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

/**
 * 签发 Refresh Token（长期，30天）
 */
export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId } as TokenPayload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

/**
 * 验证 Access Token
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
}

/**
 * 签发 Token 对
 */
export function signTokenPair(userId: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
  };
}
