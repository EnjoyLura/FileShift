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
 * 智能压缩参数配置
 * 根据原图大小自动选择合理的压缩参数
 */
interface SmartCompressConfig {
  quality: number;
  maxWidth?: number;
  pngCompressionLevel: number;
  webpEffort: number;
  usePalette: boolean;
}

function getSmartCompressConfig(originalSize: number, userQuality?: number): SmartCompressConfig {
  const sizeKB = originalSize / 1024;

  // 用户指定了质量参数，优先使用
  if (userQuality && userQuality >= 1 && userQuality <= 100) {
    return {
      quality: userQuality,
      pngCompressionLevel: Math.min(9, Math.max(1, Math.round(userQuality / 11))),
      webpEffort: 4,
      usePalette: userQuality < 60,
    };
  }

  // 智能模式：根据文件大小自动调参
  if (sizeKB < 100) {
    // < 100KB：轻度压缩，保持高画质
    return { quality: 85, pngCompressionLevel: 6, webpEffort: 4, usePalette: false };
  } else if (sizeKB < 500) {
    // 100KB - 500KB：中等压缩
    return { quality: 75, pngCompressionLevel: 7, webpEffort: 5, usePalette: false };
  } else if (sizeKB < 2048) {
    // 500KB - 2MB：较强压缩
    return { quality: 65, maxWidth: 2400, pngCompressionLevel: 8, webpEffort: 5, usePalette: true };
  } else if (sizeKB < 5120) {
    // 2MB - 5MB：强力压缩
    return { quality: 55, maxWidth: 1920, pngCompressionLevel: 9, webpEffort: 6, usePalette: true };
  } else {
    // > 5MB：极限压缩 + 缩小尺寸
    return { quality: 45, maxWidth: 1280, pngCompressionLevel: 9, webpEffort: 6, usePalette: true };
  }
}

/**
 * 图片压缩处理器
 *
 * 支持两种模式：
 * - 智能压缩（默认）：根据原图大小自动选择最优压缩参数
 * - 自定义压缩：用户指定 quality 参数（1-100）
 *
 * 特性：
 * - JPEG: mozjpeg + progressive 扫描
 * - PNG: 最大压缩 + 调色板模式
 * - WEBP: 高质量压缩
 * - 超大图自动缩小尺寸
 */
export async function imageCompressProcessor(data: TaskJobData): Promise<string> {
  const { inputFilePath, outputDir, params } = data;

  logger.info({ inputFilePath, params }, 'Image compress processor started');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 获取图片元信息
  const inputMeta = await sharp(inputFilePath).metadata();
  const format = inputMeta.format || 'jpeg';
  const originalSize = inputMeta.size || fs.statSync(inputFilePath).size;

  // 计算智能压缩参数
  const userQuality = params.quality as number | undefined;
  const config = getSmartCompressConfig(originalSize, userQuality);

  logger.info(
    {
      originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
      format,
      config,
    },
    'Smart compression config'
  );

  // 构建 Sharp 处理管道
  let pipeline = sharp(inputFilePath);

  // 超大图自动缩小
  if (config.maxWidth && inputMeta.width && inputMeta.width > config.maxWidth) {
    pipeline = pipeline.resize({
      width: config.maxWidth,
      withoutEnlargement: true,
      fit: 'inside',
    });
    logger.info({ from: inputMeta.width, to: config.maxWidth }, 'Resizing large image');
  }

  // 生成输出文件名（保持原格式）
  const ext = path.extname(inputFilePath);
  const baseName = path.basename(inputFilePath, ext);
  const outputFileName = `${baseName}_compressed${ext}`;
  const outputPath = path.join(outputDir, outputFileName);

  // 根据格式应用压缩策略
  switch (format) {
    case 'jpeg':
    case 'jpg':
      await pipeline
        .jpeg({
          quality: config.quality,
          mozjpeg: true,
          progressive: true,
          chromaSubsampling: '4:2:0',
        })
        .toFile(outputPath);
      break;

    case 'png':
      await pipeline
        .png({
          compressionLevel: config.pngCompressionLevel,
          adaptiveFiltering: true,
          palette: config.usePalette,
          effort: 10,
        })
        .toFile(outputPath);
      break;

    case 'webp':
      await pipeline
        .webp({
          quality: config.quality,
          effort: config.webpEffort,
          smartSubsample: true,
        })
        .toFile(outputPath);
      break;

    case 'gif':
      await pipeline.gif().toFile(outputPath);
      break;

    case 'avif':
      await pipeline
        .avif({
          quality: config.quality,
          effort: config.webpEffort,
        })
        .toFile(outputPath);
      break;

    default:
      // 其他格式：尝试转为 JPEG 压缩
      await pipeline
        .jpeg({
          quality: config.quality,
          mozjpeg: true,
          progressive: true,
        })
        .toFile(outputPath.replace(ext, '.jpg'));
      // 更新输出路径
      break;
  }

  // 验证输出
  const outputStats = fs.statSync(outputPath);
  const outputMeta = await sharp(outputPath).metadata();
  const ratio = originalSize ? ((1 - outputStats.size / originalSize) * 100).toFixed(1) : 'N/A';

  logger.info(
    {
      outputPath,
      originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
      compressedSize: `${(outputStats.size / 1024).toFixed(1)}KB`,
      compressionRatio: `${ratio}%`,
      outputFormat: outputMeta.format,
      outputDimensions: `${outputMeta.width}x${outputMeta.height}`,
    },
    'Image compression completed'
  );

  return outputPath;
}
