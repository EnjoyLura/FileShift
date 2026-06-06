// 通用 API 响应类型

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
}

// 错误码常量

export const ErrorCodes = {
  SUCCESS: 0,
  PARAM_ERROR: 40001,
  UNAUTHORIZED: 40101,
  TOKEN_EXPIRED: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  INSUFFICIENT_POINTS: 42201,
  UNSUPPORTED_FORMAT: 42202,
  FILE_SIZE_EXCEEDED: 42203,
  RATE_LIMITED: 42901,
  SERVER_ERROR: 50001,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
