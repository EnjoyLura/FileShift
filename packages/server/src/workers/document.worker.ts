import { createWorker, type ProcessorFn } from './base.worker.js';
import { pdfMergeProcessor } from '../processors/document/pdfMerge.js';
import { pdfSplitProcessor } from '../processors/document/pdfSplit.js';
import {
  libreOfficeConvertProcessor,
  getLibreOfficeToolIds,
} from '../processors/document/pdfConvert.js';

/**
 * 文档处理器映射
 * toolId -> 处理函数
 */
const documentProcessors: Record<string, ProcessorFn> = {
  // PDF 合并
  'pdf-merge': pdfMergeProcessor,

  // PDF 拆分
  'pdf-split': pdfSplitProcessor,
};

// 自动注册所有 LibreOffice 转换处理器
for (const toolId of getLibreOfficeToolIds()) {
  documentProcessors[toolId] = libreOfficeConvertProcessor;
}

// Mock 工具保留（兼容测试）
const mockHandler: ProcessorFn = async (data) => {
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
};

documentProcessors['mock-tool'] = mockHandler;
documentProcessors['mock-convert'] = mockHandler;
documentProcessors['mock-compress'] = mockHandler;

/**
 * 创建文档 Worker
 * 消费 documentQueue，处理文档相关任务
 */
export function createDocumentWorker() {
  return createWorker('file-document', documentProcessors, { concurrency: 3 });
}
