/**
 * 微信 OAuth 服务层
 * 负责: 生成授权URL、OAuth回调处理、微信登录/注册、绑定/解绑
 */
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { nanoid } from 'nanoid';
import { signTokenPair } from '../utils/jwt.js';
import {
  getAccessToken,
  getUserInfo,
  buildAuthUrl,
} from '../utils/wechat.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes, PointsTransactionType } from '@fileshift/shared';

const REGISTER_BONUS_POINTS = 50;

// Redis key 前缀
const WECHAT_STATE_PREFIX = 'wechat:state:';
const WECHAT_STATE_TTL = 600; // 10分钟
const WECHAT_POLL_PREFIX = 'wechat:poll:';
const WECHAT_POLL_TTL = 600;

// ========== 生成授权 URL ==========

export async function generateAuthUrl(mode: 'pc' | 'mobile' = 'pc') {
  const state = nanoid(32);

  // 存储 state 到 Redis，回调时校验
  await redis.setex(
    `${WECHAT_STATE_PREFIX}${state}`,
    WECHAT_STATE_TTL,
    JSON.stringify({ mode, createdAt: Date.now() })
  );

  // 如果是 PC 模式，预创建一个 poll key 用于前端轮询
  let pollId: string | undefined;
  if (mode === 'pc') {
    pollId = nanoid(16);
    await redis.setex(
      `${WECHAT_POLL_PREFIX}${pollId}`,
      WECHAT_POLL_TTL,
      JSON.stringify({ status: 'pending' })
    );
  }

  const url = buildAuthUrl(state, mode);

  return { url, state, pollId };
}

// ========== OAuth 回调处理 ==========

export interface CallbackResult {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    points: number;
    vipType: string | null;
  };
  isNewUser: boolean;
}

export async function handleCallback(code: string, state: string): Promise<CallbackResult> {
  // 1. 校验 state 防 CSRF
  const stateKey = `${WECHAT_STATE_PREFIX}${state}`;
  const stateData = await redis.get(stateKey);
  if (!stateData) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '授权已过期或无效，请重新登录', 400);
  }

  // 删除已使用的 state
  await redis.del(stateKey);

  // 2. 用 code 换 access_token
  const tokenResult = await getAccessToken(code);

  // 3. 获取微信用户信息
  let userInfo;
  try {
    userInfo = await getUserInfo(tokenResult.access_token, tokenResult.openid);
  } catch {
    // 获取用户信息失败，使用默认信息
    userInfo = null;
  }

  // 4. 查找或创建用户
  const result = await loginOrRegisterByWechat(
    tokenResult.openid,
    tokenResult.unionid || null,
    userInfo
      ? {
          nickname: userInfo.nickname,
          avatar: userInfo.headimgurl,
        }
      : null
  );

  // 5. 如果是 PC 模式，查找关联的 poll key 并更新
  const pollKeys = await redis.keys(`${WECHAT_POLL_PREFIX}*`);
  for (const key of pollKeys) {
    const pollData = await redis.get(key);
    if (pollData) {
      const parsed = JSON.parse(pollData);
      if (parsed.status === 'pending') {
        // 将 token 信息写入 pollkey，供前端轮询
        await redis.setex(
          key,
          120, // 2分钟
          JSON.stringify({
            status: 'completed',
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            user: result.user,
          })
        );
        break;
      }
    }
  }

  return result;
}

// ========== 微信登录/注册 ==========

export async function loginOrRegisterByWechat(
  openid: string,
  unionid: string | null,
  userInfo: { nickname: string; avatar: string } | null
): Promise<CallbackResult> {
  // 查找已绑定微信的用户
  let user = await prisma.user.findUnique({ where: { wechatOpenid: openid } });

  let isNewUser = false;

  if (!user) {
    // 自动注册新用户
    isNewUser = true;
    const nickname = userInfo?.nickname || `微信用户${nanoid(4)}`;

    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          nickname,
          avatar: userInfo?.avatar || null,
          wechatOpenid: openid,
          wechatUnionid: unionid,
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
          description: '微信注册赠送积分',
        },
      });

      return newUser;
    });
  } else {
    // 已有用户，更新 unionid 和头像
    if (user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.FORBIDDEN, '账号已被禁用', 403);
    }

    const updateData: Record<string, unknown> = {};
    if (unionid && !user.wechatUnionid) {
      updateData.wechatUnionid = unionid;
    }
    if (userInfo?.avatar && !user.avatar) {
      updateData.avatar = userInfo.avatar;
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  // 签发 JWT
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
    isNewUser,
  };
}

// ========== 微信绑定 ==========

export async function bindWechat(userId: string, code: string) {
  // 检查是否已绑定
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { wechatOpenid: true, nickname: true, avatar: true },
  });

  if (existing?.wechatOpenid) {
    throw new AppError(ErrorCodes.CONFLICT, '该账号已绑定微信', 409);
  }

  // 用 code 换 openid
  let tokenResult;
  try {
    tokenResult = await getAccessToken(code);
  } catch {
    throw new AppError(ErrorCodes.PARAM_ERROR, '微信授权失败，请重新扫码', 400);
  }

  // 检查 openid 是否已被其他账号绑定
  const conflictUser = await prisma.user.findUnique({
    where: { wechatOpenid: tokenResult.openid },
  });

  if (conflictUser && conflictUser.id !== userId) {
    throw new AppError(ErrorCodes.CONFLICT, '该微信已绑定其他账号', 409);
  }

  // 获取用户信息
  let nickname: string | undefined;
  let avatar: string | undefined;
  try {
    const info = await getUserInfo(tokenResult.access_token, tokenResult.openid);
    nickname = info.nickname;
    avatar = info.headimgurl;
  } catch {
    // 获取用户信息失败不阻塞绑定
  }

  // 更新用户
  await prisma.user.update({
    where: { id: userId },
    data: {
      wechatOpenid: tokenResult.openid,
      wechatUnionid: tokenResult.unionid || null,
      ...(nickname && !existing?.nickname ? { nickname } : {}),
      ...(avatar && !existing?.avatar ? { avatar } : {}),
    },
  });

  return { message: '微信绑定成功' };
}

// ========== 微信解绑 ==========

export async function unbindWechat(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      wechatOpenid: true,
      email: true,
      phone: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  if (!user.wechatOpenid) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '该账号未绑定微信', 400);
  }

  // 安全检查：必须至少有另一种登录方式
  const hasOtherLogin = !!(user.email && user.passwordHash) || !!user.phone;
  if (!hasOtherLogin) {
    throw new AppError(
      ErrorCodes.PARAM_ERROR,
      '解绑微信后无法登录，请先绑定邮箱或手机号',
      400
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      wechatOpenid: null,
      wechatUnionid: null,
    },
  });

  return { message: '微信解绑成功' };
}

// ========== PC 轮询登录状态 ==========

export async function checkPollStatus(pollId: string) {
  const key = `${WECHAT_POLL_PREFIX}${pollId}`;
  const data = await redis.get(key);

  if (!data) {
    throw new AppError(ErrorCodes.NOT_FOUND, '二维码已过期，请刷新重试', 404);
  }

  const parsed = JSON.parse(data);

  if (parsed.status === 'completed') {
    // 返回后删除，防止重复使用
    await redis.del(key);
    return {
      status: 'completed' as const,
      tokens: {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      },
      user: parsed.user,
    };
  }

  return { status: 'pending' as const };
}
