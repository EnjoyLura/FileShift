import { createWorker, type ProcessorFn } from './base.worker.js';
import { pdfMergeProcessor } from '../processors/document/pdfMerge.js';
import { pdfSplitProcessor } from '../processors/document/pdfSplit.js';

/**
 * 文档处理器映射
 * toolId -> 处理函数
 */
const documentProcessors: Record<string, ProcessorFn> = {
  // PDF 合并
  'pdf-merge': pdfMergeProcessor,

  // PDF 拆分
  'pdf-split': pdfSplitProcessor,

  // Mock 工具保留（兼容测试）
  'mock-tool': async (data) => {
    const fs = await import('fs');
    const path = await import('path');
    const { OUTPUT_DIR } = await import('../middleware/upload.js');

    await new Promise((r) => setTimeout(r, 3000));
    const ext = path.extname(data.inputFilePath);
    const outputFileName = `mock_output_${Date.now()}${ext}`;
    const outputPath = path.join(data.outputDir || OUTPUT_DIR, outputFileName);
    if (!fs.existsSync(data.outputDir || OUTPUT_DIR)) {
      fs.mkdirSync(data.outputDir || OUTPUT_DIR, { recursive: true });
    }
    fs.copyFileSync(data.inputFilePath, outputPath);
    return outputPath;
  },
  'mock-convert': async (data) => {
    const fs = await import('fs');
    const path = await import('path');
    const { OUTPUT_DIR } = await import('../middleware/upload.js');

    await new Promise((r) => setTimeout(r, 3000));
    const ext = path.extname(data.inputFilePath);
    const outputFileName = `mock_output_${Date.now()}${ext}`;
    const outputPath = path.join(data.outputDir || OUTPUT_DIR, outputFileName);
    if (!fs.existsSync(data.outputDir || OUTPUT_DIR)) {
      fs.mkdirSync(data.outputDir || OUTPUT_DIR, { recursive: true });
    }
    fs.copyFileSync(data.inputFilePath, outputPath);
    return outputPath;
  },
  'mock-compress': async (data) => {
    const fs = await import('fs');
    const path = await import('path');
    const { OUTPUT_DIR } = await import('../middleware/upload.js');

    await new Promise((r) => setTimeout(r, 3000));
    const ext = path.extname(data.inputFilePath);
    const outputFileName = `mock_output_${Date.now()}${ext}`;
    const outputPath = path.join(data.outputDir || OUTPUT_DIR, outputFileName);
    if (!fs.existsSync(data.outputDir || OUTPUT_DIR)) {
      fs.mkdirSync(data.outputDir || OUTPUT_DIR, { recursive: true });
    }
    fs.copyFileSync(data.inputFilePath, outputPath);
    return outputPath;
  },
};

/**
 * 创建文档 Worker
 * 消费 documentQueue，处理 PDF 合并/拆分和 Mock 任务
 */
export function createDocumentWorker() {
  return createWorker('file-document', documentProcessors, { concurrency: 3 });
}
