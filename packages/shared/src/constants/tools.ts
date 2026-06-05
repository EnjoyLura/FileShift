import { ToolCategory } from '../types/tool.js';

// 工具常量定义（所有支持的转换工具）

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  pointsCost: number;
  vipDiscount: number;
  maxFileSize: number; // 字节
  inputFormats: string[];
  outputFormats: string[];
}

// 文档类工具
export const DOCUMENT_TOOLS: ToolConfig[] = [
  {
    id: 'pdf-to-word',
    name: 'PDF 转 Word',
    description: '将 PDF 文件转换为可编辑的 Word 文档',
    category: ToolCategory.DOCUMENT,
    pointsCost: 5,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['pdf'],
    outputFormats: ['docx'],
  },
  {
    id: 'word-to-pdf',
    name: 'Word 转 PDF',
    description: '将 Word 文档转换为 PDF 格式',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['docx', 'doc'],
    outputFormats: ['pdf'],
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF 转 Excel',
    description: '将 PDF 文件转换为 Excel 表格',
    category: ToolCategory.DOCUMENT,
    pointsCost: 5,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['pdf'],
    outputFormats: ['xlsx'],
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel 转 PDF',
    description: '将 Excel 表格转换为 PDF 格式',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['xlsx', 'xls'],
    outputFormats: ['pdf'],
  },
  {
    id: 'pdf-to-image',
    name: 'PDF 转图片',
    description: '将 PDF 页面转换为图片',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['pdf'],
    outputFormats: ['jpg', 'png'],
  },
  {
    id: 'image-to-pdf',
    name: '图片转 PDF',
    description: '将图片合并转换为 PDF 文档',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['jpg', 'png', 'webp'],
    outputFormats: ['pdf'],
  },
  {
    id: 'pdf-merge',
    name: 'PDF 合并',
    description: '将多个 PDF 文件合并为一个',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 100 * 1024 * 1024,
    inputFormats: ['pdf'],
    outputFormats: ['pdf'],
  },
  {
    id: 'pdf-split',
    name: 'PDF 拆分',
    description: '将 PDF 按页码拆分为多个文件',
    category: ToolCategory.DOCUMENT,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['pdf'],
    outputFormats: ['pdf'],
  },
];

// 图片类工具
export const IMAGE_TOOLS: ToolConfig[] = [
  {
    id: 'jpg-to-png',
    name: 'JPG 转 PNG',
    description: '将 JPG 图片转换为 PNG 格式',
    category: ToolCategory.IMAGE,
    pointsCost: 1,
    vipDiscount: 0.8,
    maxFileSize: 20 * 1024 * 1024,
    inputFormats: ['jpg', 'jpeg'],
    outputFormats: ['png'],
  },
  {
    id: 'png-to-jpg',
    name: 'PNG 转 JPG',
    description: '将 PNG 图片转换为 JPG 格式',
    category: ToolCategory.IMAGE,
    pointsCost: 1,
    vipDiscount: 0.8,
    maxFileSize: 20 * 1024 * 1024,
    inputFormats: ['png'],
    outputFormats: ['jpg'],
  },
  {
    id: 'webp-to-jpg',
    name: 'WEBP 转 JPG',
    description: '将 WEBP 图片转换为 JPG 格式',
    category: ToolCategory.IMAGE,
    pointsCost: 1,
    vipDiscount: 0.8,
    maxFileSize: 20 * 1024 * 1024,
    inputFormats: ['webp'],
    outputFormats: ['jpg'],
  },
  {
    id: 'heic-to-jpg',
    name: 'HEIC 转 JPG',
    description: '将 iPhone HEIC 图片转换为 JPG 格式',
    category: ToolCategory.IMAGE,
    pointsCost: 2,
    vipDiscount: 0.8,
    maxFileSize: 20 * 1024 * 1024,
    inputFormats: ['heic'],
    outputFormats: ['jpg'],
  },
  {
    id: 'image-compress',
    name: '图片压缩',
    description: '智能压缩图片体积，保持画质',
    category: ToolCategory.IMAGE,
    pointsCost: 1,
    vipDiscount: 0.8,
    maxFileSize: 20 * 1024 * 1024,
    inputFormats: ['jpg', 'jpeg', 'png', 'webp'],
    outputFormats: ['jpg', 'png', 'webp'],
  },
];

// 音视频类工具
export const MEDIA_TOOLS: ToolConfig[] = [
  {
    id: 'video-compress',
    name: '视频压缩',
    description: '压缩视频文件体积',
    category: ToolCategory.VIDEO,
    pointsCost: 10,
    vipDiscount: 0.8,
    maxFileSize: 200 * 1024 * 1024,
    inputFormats: ['mp4', 'avi', 'mov', 'mkv'],
    outputFormats: ['mp4'],
  },
  {
    id: 'video-to-gif',
    name: '视频转 GIF',
    description: '将视频片段转为 GIF 动图',
    category: ToolCategory.VIDEO,
    pointsCost: 8,
    vipDiscount: 0.8,
    maxFileSize: 200 * 1024 * 1024,
    inputFormats: ['mp4', 'avi', 'mov'],
    outputFormats: ['gif'],
  },
  {
    id: 'video-extract-audio',
    name: '视频提取音频',
    description: '从视频中分离音频轨道',
    category: ToolCategory.VIDEO,
    pointsCost: 5,
    vipDiscount: 0.8,
    maxFileSize: 200 * 1024 * 1024,
    inputFormats: ['mp4', 'avi', 'mov', 'mkv'],
    outputFormats: ['mp3'],
  },
  {
    id: 'mp3-to-wav',
    name: 'MP3 转 WAV',
    description: '将 MP3 音频转换为 WAV 格式',
    category: ToolCategory.AUDIO,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['mp3'],
    outputFormats: ['wav'],
  },
  {
    id: 'wav-to-mp3',
    name: 'WAV 转 MP3',
    description: '将 WAV 音频转换为 MP3 格式',
    category: ToolCategory.AUDIO,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['wav'],
    outputFormats: ['mp3'],
  },
  {
    id: 'audio-compress',
    name: '音频压缩',
    description: '压缩音频文件体积',
    category: ToolCategory.AUDIO,
    pointsCost: 3,
    vipDiscount: 0.8,
    maxFileSize: 50 * 1024 * 1024,
    inputFormats: ['mp3', 'wav', 'flac', 'aac'],
    outputFormats: ['mp3'],
  },
];

// 所有工具汇总
export const ALL_TOOLS: ToolConfig[] = [
  ...DOCUMENT_TOOLS,
  ...IMAGE_TOOLS,
  ...MEDIA_TOOLS,
];

// 通过 ID 获取工具配置
export function getToolById(id: string): ToolConfig | undefined {
  return ALL_TOOLS.find((tool) => tool.id === id);
}

// 按类别获取工具
export function getToolsByCategory(category: ToolCategory): ToolConfig[] {
  return ALL_TOOLS.filter((tool) => tool.category === category);
}
