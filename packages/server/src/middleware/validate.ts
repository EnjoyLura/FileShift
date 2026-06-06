import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ErrorCodes, type ApiResponse } from '@fileshift/shared';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidateSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zod 参数校验中间件工厂函数
 *
 * 用法示例:
 *   router.post('/path', validate({ body: createUserSchema }), handler);
 *   router.get('/path', validate({ query: paginationSchema }), handler);
 *   router.get('/path/:id', validate({ params: z.object({ id: z.string() }) }), handler);
 */
export function validate(schemas: ValidateSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const targets: Array<{ schema: ZodSchema; data: unknown; target: ValidationTarget }> = [];

    if (schemas.body) {
      targets.push({ schema: schemas.body, data: req.body, target: 'body' });
    }
    if (schemas.query) {
      targets.push({ schema: schemas.query, data: req.query, target: 'query' });
    }
    if (schemas.params) {
      targets.push({ schema: schemas.params, data: req.params, target: 'params' });
    }

    const errors: Array<{ target: string; message: string }> = [];

    for (const { schema, data, target } of targets) {
      try {
        const parsed = schema.parse(data);
        // 将解析后的值覆盖回 req
        if (target === 'body') req.body = parsed;
        else if (target === 'query') (req as any).validatedQuery = parsed;
        else if (target === 'params') req.params = parsed;
      } catch (err) {
        if (err instanceof ZodError) {
          for (const issue of err.issues) {
            const field = issue.path.length > 0 ? issue.path.join('.') : target;
            errors.push({ target: field, message: issue.message });
          }
        }
      }
    }

    if (errors.length > 0) {
      const response: ApiResponse<null> = {
        code: ErrorCodes.PARAM_ERROR,
        message: `参数校验失败: ${errors.map((e) => `${e.target}: ${e.message}`).join('; ')}`,
        data: null,
      };
      res.status(400).json(response);
      return;
    }

    next();
  };
}
