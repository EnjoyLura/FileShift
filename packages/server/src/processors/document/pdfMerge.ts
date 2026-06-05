import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import type { TaskJobData } from '../../workers/base.worker.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * PDF 合并处理器
 *
 * 合并多个 PDF 文件为一个
 * params.fileIds: string[] - 额外的 PDF 文件 ID（除了主 inputFileId）
 *
 * 流程：
 * 1. 读取主输入文件 + 所有额外文件
 * 2. 使用 pdf-lib 合并所有页面
 * 3. 输出合并后的 PDF
 */
export async function pdfMergeProcessor(data: TaskJobData): Promise<string> {
  const { inputFilePath, outputDir, params, taskId } = data;

  logger.info({ inputFilePath, params }, 'PDF merge processor started');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 收集所有需要合并的 PDF 文件路径
  const filePaths: string[] = [inputFilePath];

  // 从 params 中获取额外的文件 ID
  const additionalFileIds = (params.fileIds as string[]) || [];

  for (const fileId of additionalFileIds) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (file && fs.existsSync(file.storagePath)) {
      filePaths.push(file.storagePath);
    } else {
      logger.warn({ fileId }, 'Additional file not found, skipping');
    }
  }

  if (filePaths.length < 2) {
    throw new Error('PDF 合并至少需要 2 个文件');
  }

  logger.info({ fileCount: filePaths.length }, 'Merging PDFs');

  // 创建新的 PDF 文档
  const mergedPdf = await PDFDocument.create();

  // 逐个加载并合并 PDF
  let totalPages = 0;
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const pdfBytes = fs.readFileSync(filePath);

    try {
      const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      const pages = await mergedPdf.copyPages(pdf, Array.from({ length: pageCount }, (_, j) => j));

      for (const page of pages) {
        mergedPdf.addPage(page);
      }

      totalPages += pageCount;
      logger.info({ fileIndex: i, pages: pageCount }, 'Merged PDF file');
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to load PDF file');
      throw new Error(`无法加载第 ${i + 1} 个 PDF 文件: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 保存合并后的 PDF
  const mergedBytes = await mergedPdf.save();
  const outputFileName = `merged_${Date.now()}.pdf`;
  const outputPath = path.join(outputDir, outputFileName);
  fs.writeFileSync(outputPath, mergedBytes);

  logger.info(
    {
      outputPath,
      totalPages,
      fileSize: `${(mergedBytes.length / 1024).toFixed(1)}KB`,
    },
    'PDF merge completed'
  );

  return outputPath;
}
