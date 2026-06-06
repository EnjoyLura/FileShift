import type { TaskJobData } from '../../workers/base.worker.js';
import { logger } from '../../utils/logger.js';
import {
  convertWithLibreOffice,
  isLibreOfficeAvailable,
  LIBREOFFICE_CONVERSIONS,
} from '../../utils/libreoffice.js';

/**
 * 通用文档格式转换处理器（基于 LibreOffice）
 *
 * 支持的转换：
 * - PDF → Word/Excel/PPT/图片
 * - Word/Excel/PPT → PDF
 * - 旧版 Office 格式 → PDF
 *
 * 通过 toolId 自动确定输入输出格式
 */
export async function libreOfficeConvertProcessor(data: TaskJobData): Promise<string> {
  const { toolId, inputFilePath, outputDir } = data;

  logger.info({ toolId, inputFilePath }, 'LibreOffice convert processor started');

  // 检查 LibreOffice 是否可用
  const available = await isLibreOfficeAvailable();
  if (!available) {
    throw new Error(
      'LibreOffice 未安装或不可用。请安装 LibreOffice 后重试。' +
        '安装指南: https://www.libreoffice.org/download/'
    );
  }

  // 查找转换配置
  const conversion = LIBREOFFICE_CONVERSIONS[toolId as keyof typeof LIBREOFFICE_CONVERSIONS];
  if (!conversion) {
    throw new Error(`不支持的转换类型: ${toolId}`);
  }

  // 执行转换
  const outputPath = await convertWithLibreOffice(inputFilePath, outputDir, conversion.target);

  logger.info(
    {
      toolId,
      outputPath,
      targetFormat: conversion.target,
    },
    'LibreOffice conversion processor completed'
  );

  return outputPath;
}

/**
 * 获取所有 LibreOffice 转换处理器的 toolId 列表
 */
export function getLibreOfficeToolIds(): string[] {
  return Object.keys(LIBREOFFICE_CONVERSIONS);
}
