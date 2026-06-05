// 用户相关类型

export enum VipType {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export interface User {
  id: string;
  nickname: string;
  avatar: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  wechatOpenid: string | null;
  points: number;
  vipType: VipType | null;
  vipExpiresAt: string | null;
  inviteCode: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

// 登录/注册请求类型

export interface EmailRegisterRequest {
  email: string;
  password: string;
  inviteCode?: string;
}

export interface EmailLoginRequest {
  email: string;
  password: string;
}

export interface PhoneLoginRequest {
  phone: string;
  code: string;
}

export interface SendSmsCodeRequest {
  phone: string;
  type: 'LOGIN' | 'BIND_PHONE';
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// 登录响应类型

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: Pick<User, 'id' | 'nickname' | 'avatar' | 'points' | 'vipType'>;
}
