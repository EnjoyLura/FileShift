// 任务相关类型

export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Task {
  id: string;
  userId: string;
  toolId: string;
  status: TaskStatus;
  inputFileId: string;
  outputFileId: string | null;
  params: Record<string, unknown>;
  pointsConsumed: number;
  pointsRefunded: boolean;
  errorMessage: string | null;
  progress: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateTaskRequest {
  toolId: string;
  inputFileId: string;
  params?: Record<string, unknown>;
}

export interface TaskDetail extends Task {
  tool: {
    id: string;
    name: string;
    category: string;
  };
  inputFile: {
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
  };
  outputFile: {
    id: string;
    originalName: string;
    size: number;
    downloadUrl: string;
  } | null;
}
