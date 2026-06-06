import type { Request, Response, NextFunction } from 'express';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public code: number,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const response: ApiResponse<null> = {
      code: err.code,
      message: err.message,
      data: null,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  logger.error({ err }, 'Unhandled error');

  const response: ApiResponse<null> = {
    code: ErrorCodes.SERVER_ERROR,
    message: '服务器内部错误，请稍后重试',
    data: null,
  };
  res.status(500).json(response);
}
