// 工具相关类型

export enum ToolCategory {
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  pointsCost: number;
  vipDiscount: number;
  maxFileSize: number;
  inputFormats: string[];
  outputFormats: string[];
  enabled: boolean;
  priority: number;
}

// 文件相关类型

export enum FileType {
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
}

export interface FileInfo {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  fileType: FileType;
  createdAt: string;
  expiresAt: string | null;
}

export interface UploadFileResponse {
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
}
