import { prisma } from '../config/database.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.js';
import { signTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import {
  storeSmsCode,
  verifySmsCode,
  isSmsCooldown,
  blacklistRefreshToken,
  isRefreshTokenBlacklisted,
} from '../config/redis.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes, PointsTransactionType } from '@fileshift/shared';
import { nanoid } from 'nanoid';

const REGISTER_BONUS_POINTS = 50;

// ========== 邮箱注册 ==========

export async function registerWithEmail(email: string, password: string, inviteCode?: string) {
  // 校验邮箱格式
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '邮箱格式不正确', 400);
  }

  // 校验密码强度
  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.valid) {
    throw new AppError(ErrorCodes.PARAM_ERROR, pwdCheck.message, 400);
  }

  // 检查邮箱是否已注册
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(ErrorCodes.CONFLICT, '该邮箱已被注册', 409);
  }

  // 校验邀请码（如果提供）
  let invitedBy: string | null = null;
  if (inviteCode) {
    const inviter = await prisma.user.findUnique({ where: { inviteCode } });
    if (!inviter) {
      throw new AppError(ErrorCodes.PARAM_ERROR, '邀请码无效', 400);
    }
    invitedBy = inviter.id;
  }

  // 生成随机昵称
  const nickname = `用户${nanoid(6)}`;

  // 哈希密码
  const passwordHash = await hashPassword(password);

  // 创建用户 + 赠送积分（事务）
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        nickname,
        invitedBy,
        points: REGISTER_BONUS_POINTS,
      },
    });

    // 记录注册赠送积分流水
    await tx.pointsTransaction.create({
      data: {
        userId: newUser.id,
        type: PointsTransactionType.REGISTER_BONUS,
        amount: REGISTER_BONUS_POINTS,
        balanceAfter: REGISTER_BONUS_POINTS,
        description: '新用户注册赠送积分',
      },
    });

    // 如果有邀请人，给邀请人发奖励
    if (invitedBy) {
      const inviteReward = 20;
      await tx.user.update({
        where: { id: invitedBy },
        data: { points: { increment: inviteReward } },
      });

      // 邀请人积分流水
      const inviterUser = await tx.user.findUnique({
        where: { id: invitedBy },
        select: { points: true },
      });

      await tx.pointsTransaction.create({
        data: {
          userId: invitedBy,
          type: PointsTransactionType.INVITE_REWARD,
          amount: inviteReward,
          balanceAfter: inviterUser?.points ?? inviteReward,
          description: `邀请好友注册奖励（${email.slice(0, 3)}***）`,
        },
      });
    }

    return newUser;
  });

  // 签发 Token
  const tokens = signTokenPair(user.id);

  return {
    tokens,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      points: user.points,
      vipType: user.vipType,
    },
  };
}

// ========== 邮箱登录 ==========

export async function loginWithEmail(email: string, password: string) {
  // 查找用户
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '邮箱或密码错误', 400);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(ErrorCodes.FORBIDDEN, '账号已被禁用', 403);
  }

  // 校验密码
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '邮箱或密码错误', 400);
  }

  // 签发 Token
  const tokens = signTokenPair(user.id);

  return {
    tokens,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      points: user.points,
      vipType: user.vipType,
    },
  };
}

// ========== 手机号登录 ==========

export async function sendSmsCode(phone: string) {
  // 校验手机号格式（中国大陆手机号）
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '手机号格式不正确', 400);
  }

  // 检查冷却时间
  const inCooldown = await isSmsCooldown(phone);
  if (inCooldown) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '发送过于频繁，请60秒后再试', 429);
  }

  // 生成6位随机验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 存储验证码到 Redis
  await storeSmsCode(phone, code);

  // TODO: 接入实际短信发送服务（阿里云/腾讯云 SMS）
  // 开发环境直接返回验证码（生产环境应删除此行）
  if (process.env.NODE_ENV === 'development') {
    return { message: '验证码已发送', devCode: code };
  }

  return { message: '验证码已发送' };
}

export async function loginWithPhone(phone: string, code: string) {
  // 校验验证码
  const isValid = await verifySmsCode(phone, code);
  if (!isValid) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '验证码错误或已过期', 400);
  }

  // 查找用户
  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    // 自动注册新用户
    const nickname = `用户${nanoid(6)}`;
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          phone,
          phoneVerified: true,
          nickname,
          points: REGISTER_BONUS_POINTS,
        },
      });

      await tx.pointsTransaction.create({
        data: {
          userId: newUser.id,
          type: PointsTransactionType.REGISTER_BONUS,
          amount: REGISTER_BONUS_POINTS,
          balanceAfter: REGISTER_BONUS_POINTS,
          description: '新用户注册赠送积分',
        },
      });

      return newUser;
    });
  } else {
    if (user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.FORBIDDEN, '账号已被禁用', 403);
    }
    // 标记手机号已验证
    if (!user.phoneVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }
  }

  // 签发 Token
  const tokens = signTokenPair(user.id);

  return {
    tokens,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      points: user.points,
      vipType: user.vipType,
    },
  };
}

// ========== Token 刷新 ==========

export async function refreshTokens(refreshToken: string) {
  // 检查黑名单
  const isBlacklisted = await isRefreshTokenBlacklisted(refreshToken);
  if (isBlacklisted) {
    throw new AppError(ErrorCodes.TOKEN_EXPIRED, '登录已过期，请重新登录', 401);
  }

  // 验证 Refresh Token
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(ErrorCodes.TOKEN_EXPIRED, '刷新令牌已过期，请重新登录', 401);
  }

  // 确认用户存在
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(ErrorCodes.UNAUTHORIZED, '用户不存在或已被禁用', 401);
  }

  // 签发新的 Token 对
  const tokens = signTokenPair(user.id);

  // 将旧的 Refresh Token 加入黑名单
  await blacklistRefreshToken(refreshToken, 30 * 24 * 60 * 60); // 30天

  return { tokens };
}

// ========== 登出 ==========

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    // 计算剩余有效期
    const now = Math.floor(Date.now() / 1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ttl = ((payload as any).exp as number || now) - now;
    if (ttl > 0) {
      await blacklistRefreshToken(refreshToken, ttl);
    }
  } catch {
    // Token 无效或已过期，忽略
  }

  return { message: '登出成功' };
}

// ========== 用户信息 ==========

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      avatar: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      wechatOpenid: true,
      points: true,
      vipType: true,
      vipExpiresAt: true,
      inviteCode: true,
      consecutiveSignInDays: true,
      lastSignInAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  // 脱敏处理
  return {
    ...user,
    email: user.email ? maskEmail(user.email) : null,
    phone: user.phone ? maskPhone(user.phone) : null,
    wechatBound: !!user.wechatOpenid,
  };
}

export async function updateUserProfile(
  userId: string,
  data: { nickname?: string; avatar?: string }
) {
  if (data.nickname !== undefined) {
    if (data.nickname.length < 2 || data.nickname.length > 20) {
      throw new AppError(ErrorCodes.PARAM_ERROR, '昵称长度需在2-20个字符之间', 400);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
    select: {
      id: true,
      nickname: true,
      avatar: true,
    },
  });

  return user;
}

// ========== 工具函数 ==========

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(7);
}
