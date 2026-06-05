import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import type { TaskJobData } from '../../workers/base.worker.js';
import { logger } from '../../utils/logger.js';

/**
 * 支持的输出格式映射
 */
const FORMAT_MAP: Record<string, keyof sharp.FormatEnum> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
  tiff: 'tiff',
};

/**
 * 输出格式对应的文件扩展名
 */
const EXT_MAP: Record<string, string> = {
  jpeg: '.jpg',
  jpg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
  avif: '.avif',
  tiff: '.tiff',
};

/**
 * 图片格式转换处理器
 *
 * 支持的转换：
 * - JPG ↔ PNG
 * - JPG ↔ WEBP
 * - PNG ↔ WEBP
 * - 任意支持格式互转
 */
export async function imageConvertProcessor(data: TaskJobData): Promise<string> {
  const { inputFilePath, outputDir, params } = data;

  logger.info({ inputFilePath, params }, 'Image convert processor started');

  // 确定输出格式
  // 从 toolId 推断输出格式（如 jpg-to-png → png），优先使用 params.outputFormat
  let outputFormat = params.outputFormat as string | undefined;
  if (!outputFormat && data.toolId) {
    // 从 toolId 提取目标格式，如 "jpg-to-png" → "png"
    const toMatch = data.toolId.match(/-to-(\w+)$/);
    if (toMatch) {
      outputFormat = toMatch[1];
    }
  }
  outputFormat = outputFormat || 'png';
  const sharpFormat = FORMAT_MAP[outputFormat.toLowerCase()];

  if (!sharpFormat) {
    throw new Error(`Unsupported output format: ${outputFormat}`);
  }

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成输出文件名
  const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
  const ext = EXT_MAP[outputFormat.toLowerCase()] || `.${outputFormat}`;
  const outputFileName = `${baseName}_converted${ext}`;
  const outputPath = path.join(outputDir, outputFileName);

  // 使用 Sharp 进行格式转换
  const image = sharp(inputFilePath);

  // 获取图片元信息
  const metadata = await image.metadata();
  logger.info(
    {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    },
    'Input image metadata'
  );

  // 根据输出格式设置转换参数
  switch (sharpFormat) {
    case 'jpeg':
      await image
        .jpeg({
          quality: (params.quality as number) || 85,
          mozjpeg: true,
        })
        .toFile(outputPath);
      break;

    case 'png':
      await image
        .png({
          compressionLevel: (params.compressionLevel as number) || 6,
          adaptiveFiltering: true,
        })
        .toFile(outputPath);
      break;

    case 'webp':
      await image
        .webp({
          quality: (params.quality as number) || 80,
          effort: 4,
        })
        .toFile(outputPath);
      break;

    case 'gif':
      await image.gif().toFile(outputPath);
      break;

    case 'avif':
      await image
        .avif({
          quality: (params.quality as number) || 50,
          effort: 4,
        })
        .toFile(outputPath);
      break;

    case 'tiff':
      await image
        .tiff({
          quality: (params.quality as number) || 80,
        })
        .toFile(outputPath);
      break;

    default:
      await image.toFormat(sharpFormat).toFile(outputPath);
  }

  // 验证输出文件
  const outputStats = fs.statSync(outputPath);
  const outputMeta = await sharp(outputPath).metadata();

  logger.info(
    {
      outputPath,
      outputSize: outputStats.size,
      outputFormat: outputMeta.format,
      compressionRatio: `${((1 - outputStats.size / (metadata.size || 1)) * 100).toFixed(1)}%`,
    },
    'Image conversion completed'
  );

  return outputPath;
}

/**
 * 图片压缩处理器
 *
 * 智能压缩图片体积，保持画质
 */
export async function imageCompressProcessor(data: TaskJobData): Promise<string> {
  const { inputFilePath, outputDir, params } = data;

  logger.info({ inputFilePath, params }, 'Image compress processor started');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成输出文件名（保持原格式）
  const ext = path.extname(inputFilePath);
  const baseName = path.basename(inputFilePath, ext);
  const outputFileName = `${baseName}_compressed${ext}`;
  const outputPath = path.join(outputDir, outputFileName);

  const image = sharp(inputFilePath);
  const metadata = await image.metadata();
  const format = metadata.format || 'jpeg';

  // 根据原格式选择压缩策略
  const quality = (params.quality as number) || 75;

  switch (format) {
    case 'jpeg':
    case 'jpg':
      await image
        .jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
        })
        .toFile(outputPath);
      break;

    case 'png':
      await image
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true, // 使用调色板模式减小体积
        })
        .toFile(outputPath);
      break;

    case 'webp':
      await image
        .webp({
          quality,
          effort: 6,
        })
        .toFile(outputPath);
      break;

    default:
      // 其他格式转为优化的原格式
      await image.toFile(outputPath);
  }

  const outputStats = fs.statSync(outputPath);
  const ratio = metadata.size
    ? ((1 - outputStats.size / metadata.size) * 100).toFixed(1)
    : 'N/A';

  logger.info(
    {
      outputPath,
      originalSize: metadata.size,
      compressedSize: outputStats.size,
      compressionRatio: `${ratio}%`,
    },
    'Image compression completed'
  );

  return outputPath;
}
