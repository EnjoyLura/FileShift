import { createWorker, type ProcessorFn } from './base.worker.js';
import { imageConvertProcessor, imageCompressProcessor } from '../processors/image/convert.js';

/**
 * 图片处理器映射
 * toolId -> 处理函数
 */
const imageProcessors: Record<string, ProcessorFn> = {
  // 格式转换
  'jpg-to-png': imageConvertProcessor,
  'png-to-jpg': imageConvertProcessor,
  'webp-to-jpg': imageConvertProcessor,
  'webp-to-png': imageConvertProcessor,
  'jpg-to-webp': imageConvertProcessor,
  'heic-to-jpg': imageConvertProcessor,
  'bmp-to-jpg': imageConvertProcessor,
  'svg-to-png': imageConvertProcessor,
  'png-to-ico': imageConvertProcessor,

  // 图片压缩
  'image-compress': imageCompressProcessor,
};

/**
 * 创建图片 Worker
 * 消费 imageQueue，处理图片格式转换和压缩任务
 */
export function createImageWorker() {
  return createWorker('file-image', imageProcessors, { concurrency: 5 });
}
