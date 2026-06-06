import { useState, useRef, useCallback } from 'react';
import api from '@/services/api';
import { TaskStatus } from '@fileshift/shared';
import type { TaskDetail, UploadFileResponse } from '@fileshift/shared';

// ========== 任务生命周期状态 ==========

export type TaskPhase =
  | 'idle'         // 初始状态
  | 'uploading'    // 文件上传中
  | 'error'        // 出错（可恢复）
  | 'ready'        // 文件已上传，等待配置/提交
  | 'submitting'   // 创建任务中
  | 'processing'   // 任务处理中（轮询中）
  | 'completed'    // 任务完成
  | 'failed';      // 任务失败

export interface TaskState {
  phase: TaskPhase;
  /** 上传后的文件信息 */
  uploadedFile: { fileId: string; originalName: string; size: number; mimeType: string } | null;
  /** 任务详情 */
  task: TaskDetail | null;
  /** 错误消息 */
  error: string | null;
  /** 进度 0-100 */
  progress: number;
}

// ========== 指数退避轮询间隔（秒） ==========

const BACKOFF_INTERVALS = [1, 2, 3, 5, 8, 13, 21, 30];
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟超时

/**
 * useTask — 封装文件上传 → 任务创建 → 状态轮询的完整生命周期
 *
 * 用法：
 *   const { state, uploadFile, submitTask, reset } = useTask();
 *
 *   1. uploadFile(file, toolId) → phase='ready', uploadedFile 已设置
 *   2. submitTask(toolId, params) → phase='processing', 自动轮询
 *   3. 轮询至 completed/failed，自动停止
 *   4. reset() 回到初始状态，可重新操作
 */
export function useTask() {
  const [state, setState] = useState<TaskState>({
    phase: 'idle',
    uploadedFile: null,
    task: null,
    error: null,
    progress: 0,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);
  const pollAttemptRef = useRef<number>(0);

  // ========== 清理定时器 ==========

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ========== 上传文件 ==========

  const uploadFile = useCallback(
    async (file: File, toolId?: string): Promise<boolean> => {
      setState((s) => ({ ...s, phase: 'uploading', error: null }));

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (toolId) formData.append('toolId', toolId);

        const res = await api.post<{ code: number; message: string; data: UploadFileResponse }>(
          '/v1/files/upload',
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120_000, // 上传超时 2 分钟
          }
        );

        if (res.data.code === 0 && res.data.data) {
          const { fileId, originalName, size, mimeType } = res.data.data;
          setState((s) => ({
            ...s,
            phase: 'ready',
            uploadedFile: { fileId, originalName, size, mimeType },
            error: null,
          }));
          return true;
        }

        setState((s) => ({
          ...s,
          phase: 'error',
          error: res.data.message || '上传失败',
        }));
        return false;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : '网络错误，上传失败';
        setState((s) => ({ ...s, phase: 'error', error: message }));
        return false;
      }
    },
    []
  );

  // ========== 轮询任务状态 ==========

  const pollTask = useCallback(
    (taskId: string, resolve: (detail: TaskDetail) => void, reject: (err: Error) => void) => {
      const attempt = pollAttemptRef.current;
      const elapsed = Date.now() - pollStartRef.current;

      // 超时
      if (elapsed > POLL_TIMEOUT_MS) {
        setState((s) => ({ ...s, phase: 'failed', error: '任务处理超时，请稍后重试' }));
        reject(new Error('任务处理超时'));
        return;
      }

      api
        .get<{ code: number; data: TaskDetail }>(`/v1/tasks/${taskId}`)
        .then((res) => {
          if (res.data.code !== 0 || !res.data.data) {
            setState((s) => ({ ...s, phase: 'failed', error: '查询任务失败' }));
            reject(new Error('查询任务失败'));
            return;
          }

          const detail = res.data.data;

          if (detail.status === TaskStatus.COMPLETED) {
            setState((s) => ({
              ...s,
              phase: 'completed',
              task: detail,
              progress: 100,
              error: null,
            }));
            resolve(detail);
            return;
          }

          if (detail.status === TaskStatus.FAILED) {
            setState((s) => ({
              ...s,
              phase: 'failed',
              task: detail,
              error: detail.errorMessage || '任务处理失败',
            }));
            reject(new Error(detail.errorMessage || '任务处理失败'));
            return;
          }

          // 仍在处理中，更新进度
          setState((s) => ({
            ...s,
            phase: 'processing',
            task: detail,
            progress: detail.progress ?? Math.min(95, attempt * 5),
          }));

          // 计算下次轮询间隔（指数退避）
          pollAttemptRef.current++;
          const interval =
            BACKOFF_INTERVALS[Math.min(attempt, BACKOFF_INTERVALS.length - 1)] * 1000;

          pollTimerRef.current = setTimeout(() => pollTask(taskId, resolve, reject), interval);
        })
        .catch((_err: unknown) => {
          // 网络错误时继续轮询，不立即失败
          pollAttemptRef.current++;
          const interval =
            BACKOFF_INTERVALS[Math.min(attempt, BACKOFF_INTERVALS.length - 1)] * 1000;
          pollTimerRef.current = setTimeout(() => pollTask(taskId, resolve, reject), interval);
        });
    },
    []
  );

  // ========== 提交任务（创建 + 开始轮询） ==========

  const submitTask = useCallback(
    (toolId: string, params: Record<string, unknown> = {}): Promise<TaskDetail> => {
      return new Promise(async (resolve, reject) => {
        const currentUploadedFile = state.uploadedFile;
        if (!currentUploadedFile) {
          setState((s) => ({ ...s, phase: 'error', error: '请先上传文件' }));
          reject(new Error('请先上传文件'));
          return;
        }

        setState((s) => ({ ...s, phase: 'submitting', error: null }));

        try {
          const res = await api.post<{ code: number; message: string; data: TaskDetail }>(
            '/v1/tasks',
            {
              toolId,
              inputFileId: currentUploadedFile.fileId,
              params,
            }
          );

          if (res.data.code !== 0 || !res.data.data) {
            const errMsg = res.data.message || '创建任务失败';
            setState((s) => ({ ...s, phase: 'error', error: errMsg }));
            reject(new Error(errMsg));
            return;
          }

          const task = res.data.data;
          // 开始轮询
          pollAttemptRef.current = 0;
          pollStartRef.current = Date.now();
          setState((s) => ({ ...s, phase: 'processing', task }));

          pollTask(task.id, resolve, reject);
        } catch (err: unknown) {
          // 处理 Axios 错误中的业务错误信息
          const axiosErr = err as { response?: { data?: { message?: string; code?: number } } };
          const message =
            axiosErr?.response?.data?.message ||
            (err instanceof Error ? err.message : '网络错误，请重试');

          setState((s) => ({ ...s, phase: 'error', error: message }));
          reject(new Error(message));
        }
      });
    },
    [state.uploadedFile, pollTask]
  );

  // ========== 重置 ==========

  const reset = useCallback(() => {
    clearPolling();
    pollAttemptRef.current = 0;
    pollStartRef.current = 0;
    setState({
      phase: 'idle',
      uploadedFile: null,
      task: null,
      error: null,
      progress: 0,
    });
  }, [clearPolling]);

  // ========== 清理（组件卸载时） ==========

  const cleanup = useCallback(() => {
    clearPolling();
  }, [clearPolling]);

  return { state, uploadFile, submitTask, reset, cleanup };
}
