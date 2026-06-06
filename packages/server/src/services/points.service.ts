import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes, PointsTransactionType } from '@fileshift/shared';
import { logger } from '../utils/logger.js';

// ========== 常量 ==========

const SIGN_IN_BASE_POINTS = 2; // 每日签到基础积分
const SIGN_IN_BONUS_POINTS = 5; // 连续签到7天额外奖励
const SIGN_IN_BONUS_DAYS = 7; // 连续签到天数阈值

// ========== 积分余额 ==========

/**
 * 获取用户积分余额
 */
export async function getPointsBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      points: true,
      vipType: true,
      vipExpiresAt: true,
    },
  });

  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  // 获取 VIP 折扣（需检查 VIP 是否过期）
  let vipDiscount = 1.0;
  const now = new Date();
  if (user.vipType && user.vipExpiresAt && user.vipExpiresAt > now) {
    const vipPackage = await prisma.vipPackage.findFirst({
      where: { type: user.vipType },
      select: { discount: true },
    });
    if (vipPackage) {
      vipDiscount = vipPackage.discount;
    }
  }

  return {
    balance: user.points,
    vipType: user.vipType,
    vipExpiresAt: user.vipExpiresAt,
    vipDiscount,
  };
}

// ========== 积分流水 ==========

/**
 * 查询积分流水（分页）
 */
export async function getPointsTransactions(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  type?: string
) {
  const where: Record<string, unknown> = { userId };
  if (type) {
    where.type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pointsTransaction.count({ where }),
  ]);

  return {
    list: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      relatedTaskId: tx.relatedTaskId,
      createdAt: tx.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

// ========== 积分套餐 ==========

/**
 * 获取积分套餐列表
 */
export async function getPointsPackages() {
  const packages = await prisma.pointsPackage.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    points: pkg.points,
    price: pkg.price,
    priceDisplay: `¥${(pkg.price / 100).toFixed(2)}`,
    description: pkg.description,
  }));
}

/**
 * 获取 VIP 套餐列表
 */
export async function getVipPackages() {
  const packages = await prisma.vipPackage.findMany({
    where: { enabled: true },
    orderBy: { price: 'asc' },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    type: pkg.type,
    name: pkg.name,
    price: pkg.price,
    priceDisplay: `¥${(pkg.price / 100).toFixed(2)}`,
    durationDays: pkg.durationDays,
    monthlyPoints: pkg.monthlyPoints,
    discount: pkg.discount,
    discountDisplay: `${(pkg.discount * 10).toFixed(1).replace(/\.0$/, '')}折`,
  }));
}

// ========== 每日签到 ==========

/**
 * 每日签到
 *
 * 规则：
 * - 每天只能签到一次
 * - 基础奖励 2 积分
 * - 连续签到 7 天额外奖励 5 积分
 * - 断签后连续天数重置为 1
 */
export async function signIn(userId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 事务内完成所有读写，防止并发重复签到
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        lastSignInAt: true,
        consecutiveSignInDays: true,
      },
    });

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
    }

    // 检查今日是否已签到（事务内原子检查）
    if (user.lastSignInAt && user.lastSignInAt >= todayStart) {
      throw new AppError(ErrorCodes.PARAM_ERROR, '今日已签到，明天再来吧', 400);
    }

    // 计算连续签到天数
    let consecutiveDays = 1;
    if (user.lastSignInAt) {
      const lastSignInDate = new Date(user.lastSignInAt);
      const yesterday = new Date(todayStart);
      yesterday.setDate(yesterday.getDate() - 1);

      // 如果上次签到是昨天，连续天数 +1
      if (
        lastSignInDate.getFullYear() === yesterday.getFullYear() &&
        lastSignInDate.getMonth() === yesterday.getMonth() &&
        lastSignInDate.getDate() === yesterday.getDate()
      ) {
        consecutiveDays = user.consecutiveSignInDays + 1;
      }
    }

    // 计算奖励积分
    let earnedPoints = SIGN_IN_BASE_POINTS;
    let bonusEarned = 0;

    // 连续签到 7 天额外奖励
    if (consecutiveDays > 0 && consecutiveDays % SIGN_IN_BONUS_DAYS === 0) {
      bonusEarned = SIGN_IN_BONUS_POINTS;
      earnedPoints += bonusEarned;
    }

    // 更新用户签到信息
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: earnedPoints },
        lastSignInAt: now,
        consecutiveSignInDays: consecutiveDays,
      },
      select: { points: true },
    });

    // 写入签到流水
    const description =
      bonusEarned > 0
        ? `每日签到（连续${consecutiveDays}天，含额外奖励${bonusEarned}积分）`
        : `每日签到（连续${consecutiveDays}天）`;

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: PointsTransactionType.SIGN_IN,
        amount: earnedPoints,
        balanceAfter: updatedUser.points,
        description,
      },
    });

    return {
      pointsEarned: earnedPoints,
      bonusEarned,
      consecutiveDays,
      totalPoints: updatedUser.points,
    };
  });

  logger.info(
    { userId, ...result },
    'User signed in'
  );

  return result;
}

// ========== 积分操作（供其他服务调用） ==========

/**
 * 安全扣除积分（事务）
 * 用于任务创建等场景
 *
 * @returns 扣除后的余额和实际消耗量
 */
export async function deductPoints(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  amount: number,
  description: string,
  relatedTaskId?: string
): Promise<{ balanceAfter: number }> {
  if (amount <= 0) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '扣除金额必须大于 0', 400);
  }

  // 校验余额是否充足
  const current = await tx.user.findUnique({
    where: { id: userId },
    select: { points: true },
  });

  if (!current) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  if (current.points < amount) {
    throw new AppError(
      ErrorCodes.INSUFFICIENT_POINTS,
      `积分不足，需要 ${amount} 积分，当前余额 ${current.points}`,
      422
    );
  }

  // 原子扣减
  const user = await tx.user.update({
    where: { id: userId },
    data: { points: { decrement: amount } },
    select: { points: true },
  });

  await tx.pointsTransaction.create({
    data: {
      userId,
      type: PointsTransactionType.CONSUME,
      amount: -amount,
      balanceAfter: user.points,
      description,
      relatedTaskId,
    },
  });

  return { balanceAfter: user.points };
}

/**
 * 安全增加积分（事务）
 * 用于退还、奖励、购买等场景
 */
export async function addPoints(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  amount: number,
  type: PointsTransactionType,
  description: string,
  relatedTaskId?: string
): Promise<{ balanceAfter: number }> {
  if (amount <= 0) {
    throw new AppError(ErrorCodes.PARAM_ERROR, '增加金额必须大于 0', 400);
  }

  const user = await tx.user.update({
    where: { id: userId },
    data: { points: { increment: amount } },
    select: { points: true },
  });

  await tx.pointsTransaction.create({
    data: {
      userId,
      type,
      amount: amount,
      balanceAfter: user.points,
      description,
      relatedTaskId,
    },
  });

  return { balanceAfter: user.points };
}

// ========== 邀请好友 ==========

/**
 * 获取邀请信息
 */
export async function getInviteInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      inviteCode: true,
    },
  });

  if (!user) {
    throw new AppError(ErrorCodes.NOT_FOUND, '用户不存在', 404);
  }

  // 统计邀请人数
  const invitedCount = await prisma.user.count({
    where: { invitedBy: userId },
  });

  // 统计邀请获得的总积分
  const inviteRewards = await prisma.pointsTransaction.findMany({
    where: {
      userId,
      type: PointsTransactionType.INVITE_REWARD,
    },
    select: { amount: true },
  });

  const totalRewardPoints = inviteRewards.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    inviteCode: user.inviteCode,
    invitedCount,
    totalRewardPoints,
    rewardPerInvite: 20, // 每邀请一人双方各得 20 积分
  };
}
