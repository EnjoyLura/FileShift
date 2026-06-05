// 积分相关类型

export enum PointsTransactionType {
  REGISTER_BONUS = 'REGISTER_BONUS',
  SIGN_IN = 'SIGN_IN',
  INVITE_REWARD = 'INVITE_REWARD',
  PURCHASE = 'PURCHASE',
  CONSUME = 'CONSUME',
  REFUND = 'REFUND',
  VIP_MONTHLY = 'VIP_MONTHLY',
  PROFILE_BONUS = 'PROFILE_BONUS',
}

export interface PointsTransaction {
  id: string;
  userId: string;
  type: PointsTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  relatedTaskId: string | null;
  createdAt: string;
}

export interface PointsBalance {
  balance: number;
  vipType: string | null;
  vipDiscount: number;
}

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  priceDisplay: string;
  description: string | null;
}

// 订单相关类型

export enum OrderType {
  POINTS_PACKAGE = 'POINTS_PACKAGE',
  VIP_SUBSCRIPTION = 'VIP_SUBSCRIPTION',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  WECHAT_PAY = 'WECHAT_PAY',
  ALIPAY = 'ALIPAY',
}

export interface Order {
  id: string;
  orderNo: string;
  type: OrderType;
  amount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
  paidAt: string | null;
}

export interface PurchaseRequest {
  packageId: string;
  paymentMethod: PaymentMethod;
}

export interface PurchaseResponse {
  orderId: string;
  orderNo: string;
  qrCode: string;
}
