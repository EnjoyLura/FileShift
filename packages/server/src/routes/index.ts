import { Router } from 'express';
import type { Request, Response } from 'express';
import { ErrorCodes, ALL_TOOLS, type ApiResponse, type ToolCategory } from '@fileshift/shared';

const router = Router();

// 健康检查
router.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'ok',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
  };
  res.json(response);
});

// 获取工具列表
router.get('/v1/tools', (req: Request, res: Response) => {
  const category = req.query.category as ToolCategory | undefined;
  const keyword = req.query.keyword as string | undefined;

  let tools = ALL_TOOLS;

  if (category) {
    tools = tools.filter((t) => t.category === category);
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        t.description.toLowerCase().includes(kw) ||
        t.id.toLowerCase().includes(kw)
    );
  }

  const response: ApiResponse = {
    code: ErrorCodes.SUCCESS,
    message: 'success',
    data: tools,
  };
  res.json(response);
});

export { router as apiRouter };
