import { PDFDocument } from 'pdf-lib';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import type { TaskJobData } from '../../workers/base.worker.js';
import { logger } from '../../utils/logger.js';

/**
 * PDF 拆分处理器
 *
 * 将一个 PDF 按页码拆分为多个文件，打包为 ZIP 输出
 *
 * params 参数：
 * - splitMode: 'range' | 'every' | 'custom'
 *   - 'range': 按指定页码范围拆分 (params.ranges: [[1,3],[4,7],[8,10]])
 *   - 'every': 每页一个文件 (params.pagesPerFile?: number, 默认1)
 *   - 'custom': 自定义拆分点 (params.splitPages: [3, 7])
 *
 * 输出：包含所有拆分 PDF 的 ZIP 文件
 */
export async function pdfSplitProcessor(data: TaskJobData): Promise<string> {
  const { inputFilePath, outputDir, params } = data;

  logger.info({ inputFilePath, params }, 'PDF split processor started');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 读取输入 PDF
  const pdfBytes = fs.readFileSync(inputFilePath);
  const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();

  logger.info({ totalPages }, 'Source PDF loaded');

  // 确定拆分方式
  const splitMode = (params.splitMode as string) || 'every';
  const ranges: [number, number][] = [];

  switch (splitMode) {
    case 'range': {
      // 按指定范围拆分: [[startPage, endPage], ...]
      const userRanges = params.ranges as [number, number][] | undefined;
      if (userRanges && userRanges.length > 0) {
        for (const [start, end] of userRanges) {
          // 转换为 0-based 索引
          const s = Math.max(0, start - 1);
          const e = Math.min(totalPages, end);
          if (s < e) ranges.push([s, e]);
        }
      }
      break;
    }

    case 'custom': {
      // 按自定义页码拆分：在指定页码处切割
      const splitPages = (params.splitPages as number[]) || [];
      let prev = 0;
      for (const p of splitPages.sort((a, b) => a - b)) {
        const idx = Math.min(p - 1, totalPages);
        if (idx > prev) {
          ranges.push([prev, idx]);
          prev = idx;
        }
      }
      if (prev < totalPages) {
        ranges.push([prev, totalPages]);
      }
      break;
    }

    case 'every':
    default: {
      // 每 N 页一个文件
      const pagesPerFile = (params.pagesPerFile as number) || 1;
      for (let i = 0; i < totalPages; i += pagesPerFile) {
        ranges.push([i, Math.min(i + pagesPerFile, totalPages)]);
      }
      break;
    }
  }

  if (ranges.length === 0) {
    throw new Error('无法确定拆分范围，请检查参数');
  }

  logger.info({ ranges, splitMode }, 'Split ranges determined');

  // 创建拆分后的 PDF 文件（临时）
  const tempDir = path.join(outputDir, `split_temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const splitFiles: { name: string; path: string }[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    const pageCount = end - start;

    // 创建新 PDF
    const newPdf = await PDFDocument.create();
    const pageIndices = Array.from({ length: pageCount }, (_, j) => start + j);
    const pages = await newPdf.copyPages(sourcePdf, pageIndices);

    for (const page of pages) {
      newPdf.addPage(page);
    }

    const splitBytes = await newPdf.save();
    const fileName = `part_${i + 1}_pages_${start + 1}-${end}.pdf`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, splitBytes);

    splitFiles.push({ name: fileName, path: filePath });
    logger.info({ fileName, pages: pageCount }, 'Split PDF part created');
  }

  // 打包为 ZIP
  const zipFileName = `split_${Date.now()}.zip`;
  const zipPath = path.join(outputDir, zipFileName);

  await createZip(splitFiles, zipPath);

  // 清理临时文件
  for (const file of splitFiles) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore cleanup errors
    }
  }
  try {
    fs.rmdirSync(tempDir);
  } catch {
    // ignore cleanup errors
  }

  const zipStats = fs.statSync(zipPath);

  logger.info(
    {
      zipPath,
      partsCount: splitFiles.length,
      zipSize: `${(zipStats.size / 1024).toFixed(1)}KB`,
    },
    'PDF split completed'
  );

  return zipPath;
}

/**
 * 创建 ZIP 压缩包
 */
async function createZip(
  files: { name: string; path: string }[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    archive.finalize();
  });
}
