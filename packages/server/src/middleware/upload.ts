import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { AppError } from './errorHandler.js';
import { ErrorCodes } from '@fileshift/shared';

// 存储目录
const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './data/outputs';
const TEMP_DIR = process.env.TEMP_DIR || './data/temp';

// 确保目录存在
function ensureDirectories() {
  for (const dir of [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
ensureDirectories();

// 最大文件大小（默认 200MB）
const MAX_FILE_SIZE = (Number(process.env.MAX_FILE_SIZE_MB) || 200) * 1024 * 1024;

// MIME 类型白名单
const ALLOWED_MIME_TYPES = new Set([
  // 文档
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/markdown',
  'text/plain',
  // 图片
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  // 音频
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  // 视频
  'video/mp4',
  'video/x-msvideo',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/avi',
]);

// Multer 存储配置
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${nanoid(16)}${ext}`;
    cb(null, storedName);
  },
});

// 文件过滤器
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(
      new AppError(
        ErrorCodes.UNSUPPORTED_FORMAT,
        `不支持的文件格式: ${file.mimetype}`,
        422
      )
    );
    return;
  }
  cb(null, true);
}

// 创建 Multer 实例
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // 单次只允许上传1个文件
  },
});

// 导出常量供其他模块使用
export { UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
