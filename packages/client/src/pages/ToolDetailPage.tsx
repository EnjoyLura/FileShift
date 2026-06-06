import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Spin,
  Radio,
  Slider,
  Modal,
  Result,
  message,
  Card,
  Space,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ToolConfig } from '@fileshift/shared';
import { TaskStatus, ToolCategory } from '@fileshift/shared';
import { get } from '@/services/api';
import api from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTask } from '@/hooks/useTask';
import FileUploader from '@/components/FileUploader';
import ProgressBar from '@/components/ProgressBar';

const { Title, Text, Paragraph } = Typography;

// ========== 分类图标映射 ==========

const categoryIcons: Record<string, React.ReactNode> = {
  [ToolCategory.DOCUMENT]: <FileTextOutlined className="text-3xl text-orange-500" />,
  [ToolCategory.IMAGE]: <PictureOutlined className="text-3xl text-green-500" />,
  [ToolCategory.VIDEO]: <VideoCameraOutlined className="text-3xl text-blue-500" />,
  [ToolCategory.AUDIO]: <AudioOutlined className="text-3xl text-purple-500" />,
};

// ========== 需要质量参数的工具 ==========

const QUALITY_TOOLS = ['image-compress', 'audio-compress'];

// ========== 下载辅助函数 ==========

async function downloadFile(fileId: string, filename: string) {
  try {
    const res = await api.get(`/v1/files/${fileId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('开始下载');
  } catch {
    message.error('下载失败，请重试');
  }
}

// ========== ToolDetailPage ==========

export default function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { state: taskState, uploadFile, submitTask, reset: resetTask } = useTask();

  // 工具配置
  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [toolLoading, setToolLoading] = useState(true);
  const [toolNotFound, setToolNotFound] = useState(false);

  // 业务状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>('');
  const [quality, setQuality] = useState(80);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ========== 加载工具配置 ==========

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadTool() {
      setToolLoading(true);
      try {
        const res = await get<ToolConfig[]>('/v1/tools');
        if (!cancelled && res.code === 0 && res.data) {
          const found = res.data.find((t) => t.id === id);
          if (found) {
            setTool(found);
            // 默认选中第一个输出格式
            if (found.outputFormats.length > 0) {
              setOutputFormat(found.outputFormats[0]);
            }
          } else {
            setToolNotFound(true);
          }
        }
      } catch {
        if (!cancelled) setToolNotFound(true);
      } finally {
        if (!cancelled) setToolLoading(false);
      }
    }

    loadTool();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ========== 文件已上传成功 → 进入 ready 阶段 ==========

  useEffect(() => {
    if (taskState.phase === 'ready') {
      setSelectedFile(selectedFile); // 保持文件引用
    }
  }, [taskState.phase]);

  // ========== 是否需要显示参数面板 ==========

  const needsOutputFormat = tool && tool.outputFormats.length > 1;
  const needsQuality = tool && QUALITY_TOOLS.includes(tool.id);

  // ========== 处理提交 ==========

  const handleSubmit = useCallback(async () => {
    if (!tool || !id) return;

    setConfirmOpen(false);
    setIsSubmitting(true);

    // 构建参数
    const params: Record<string, unknown> = {};
    if (needsOutputFormat && outputFormat) {
      params.outputFormat = outputFormat;
    }
    if (needsQuality) {
      params.quality = quality;
    }

    try {
      // 先上传文件
      if (!taskState.uploadedFile && selectedFile) {
        const ok = await uploadFile(selectedFile, tool.id);
        if (!ok) {
          setIsSubmitting(false);
          return;
        }
      }

      // 提交任务
      await submitTask(tool.id, params);
      // 更新积分
      if (user) {
        const { useAuthStore } = await import('@/stores/useAuthStore');
        useAuthStore.getState().updatePoints(user.points - tool.pointsCost);
      }
    } catch {
      // 错误已在 useTask 中处理
    } finally {
      setIsSubmitting(false);
    }
  }, [
    tool,
    id,
    selectedFile,
    outputFormat,
    quality,
    needsOutputFormat,
    needsQuality,
    taskState.uploadedFile,
    uploadFile,
    submitTask,
    user,
  ]);

  // ========== 积分不足检查 ==========

  const hasEnoughPoints = user ? user.points >= (tool?.pointsCost ?? 0) : false;

  const handleStartConvert = useCallback(() => {
    // 先检查积分
    if (!hasEnoughPoints) {
      Modal.confirm({
        title: '积分不足',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>当前积分：{user?.points ?? 0}</p>
            <p>需要消耗：{tool?.pointsCost ?? 0} 积分</p>
            <p className="text-gray-400">请前往积分中心充值</p>
          </div>
        ),
        okText: '去充值',
        cancelText: '取消',
        onOk: () => navigate('/points'),
      });
      return;
    }

    // 未上传文件
    if (!selectedFile && !taskState.uploadedFile) {
      message.warning('请先选择文件');
      return;
    }

    setConfirmOpen(true);
  }, [
    hasEnoughPoints,
    user?.points,
    tool?.pointsCost,
    selectedFile,
    taskState.uploadedFile,
    navigate,
  ]);

  // ========== 下载 ==========

  const handleDownload = useCallback(() => {
    const outputFile = taskState.task?.outputFile;
    if (outputFile) {
      downloadFile(outputFile.id, outputFile.originalName);
    }
  }, [taskState.task]);

  // ========== 重做 ==========

  const handleReset = useCallback(() => {
    resetTask();
    setSelectedFile(null);
    setIsSubmitting(false);
  }, [resetTask]);

  // ========== 加载中 ==========

  if (toolLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // ========== 工具不存在 ==========

  if (toolNotFound || !tool) {
    return (
      <Result
        status="404"
        title="工具不存在"
        subTitle="该工具可能已被移除或地址输入有误"
        extra={
          <Button type="primary" onClick={() => navigate('/tools')}>
            浏览全部工具
          </Button>
        }
      />
    );
  }

  const isProcessing =
    taskState.phase === 'uploading' ||
    taskState.phase === 'submitting' ||
    taskState.phase === 'processing' ||
    isSubmitting;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* 返回按钮 */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2"
      >
        返回
      </Button>

      {/* ========== 工具信息头 ========== */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            {categoryIcons[tool.category] ?? <SwapOutlined className="text-3xl text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <Title level={3} className="!mb-1">
              {tool.name}
            </Title>
            <Paragraph type="secondary" className="!mb-2 text-sm">
              {tool.description}
            </Paragraph>
            <Space size={8} wrap>
              <Tag>{tool.pointsCost} 积分</Tag>
              <Tag color="default">{tool.inputFormats.map((f) => `.${f}`).join(' ')}</Tag>
            </Space>
          </div>
        </div>
      </Card>

      {/* ========== 非处理阶段：上传 + 参数配置 ========== */}
      {taskState.phase !== 'processing' &&
        taskState.phase !== 'completed' &&
        taskState.phase !== 'failed' && (
          <>
            {/* 文件上传区 */}
            <Card className="mb-6" title="1. 上传文件">
              <FileUploader
                file={selectedFile}
                onFileChange={(f) => {
                  setSelectedFile(f);
                  if (!f) resetTask();
                }}
                acceptFormats={tool.inputFormats}
                maxSize={tool.maxFileSize}
                disabled={isProcessing}
                uploadedFileId={taskState.uploadedFile?.fileId}
              />
            </Card>

            {/* 参数配置面板 */}
            {(needsOutputFormat || needsQuality) && (
              <Card className="mb-6" title="2. 参数设置">
                {/* 输出格式选择 */}
                {needsOutputFormat && (
                  <div className="mb-4">
                    <Text strong className="block mb-3">
                      输出格式
                    </Text>
                    <Radio.Group
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      disabled={isProcessing}
                      optionType="button"
                      buttonStyle="solid"
                    >
                      {tool.outputFormats.map((fmt) => (
                        <Radio.Button key={fmt} value={fmt}>
                          {fmt.toUpperCase()}
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </div>
                )}

                {/* 质量滑块 */}
                {needsQuality && (
                  <div>
                    <Text strong className="block mb-3">
                      压缩质量：{quality}%
                    </Text>
                    <Slider
                      min={10}
                      max={100}
                      value={quality}
                      onChange={setQuality}
                      disabled={isProcessing}
                      marks={{ 10: '10', 50: '50', 100: '100' }}
                    />
                    <Text type="secondary" className="text-xs">
                      数值越高，文件越大但质量越好；数值越低，文件越小但画质降低
                    </Text>
                  </div>
                )}
              </Card>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-center gap-4 mt-8 mb-12">
              <Button
                type="primary"
                size="large"
                icon={<SwapOutlined />}
                onClick={handleStartConvert}
                loading={isProcessing}
                disabled={!selectedFile && !taskState.uploadedFile}
                className="min-w-[180px] h-12 text-base"
              >
                开始转换
              </Button>
            </div>

            {/* 错误提示 */}
            {taskState.phase === 'error' && taskState.error && (
              <div className="text-center -mt-4 mb-12">
                <Text type="danger">{taskState.error}</Text>
                <br />
                <Button type="link" onClick={handleReset} className="mt-2">
                  重新上传
                </Button>
              </div>
            )}
          </>
        )}

      {/* ========== 处理中 ========== */}
      {(taskState.phase === 'processing' || taskState.phase === 'submitting') && (
        <Card className="mb-6">
          <ProgressBar
            status={taskState.task?.status ?? TaskStatus.PENDING}
            progress={taskState.progress}
            pointsConsumed={taskState.task?.pointsConsumed}
          />
        </Card>
      )}

      {/* ========== 处理失败 ========== */}
      {taskState.phase === 'failed' && (
        <>
          <Card className="mb-6">
            <ProgressBar
              status={TaskStatus.FAILED}
              progress={taskState.progress}
              errorMessage={taskState.error}
              pointsConsumed={taskState.task?.pointsConsumed}
            />
          </Card>
          <div className="flex justify-center gap-4 mt-4 mb-12">
            <Button icon={<ReloadOutlined />} onClick={handleReset} size="large">
              重新转换
            </Button>
          </div>
        </>
      )}

      {/* ========== 处理完成 ========== */}
      {taskState.phase === 'completed' && taskState.task && (
        <>
          <Card className="mb-6">
            <ProgressBar
              status={TaskStatus.COMPLETED}
              progress={100}
              pointsConsumed={taskState.task.pointsConsumed}
            />
          </Card>

          {/* 输出文件信息 */}
          {taskState.task.outputFile && (
            <Card className="mb-6 border-green-200 bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <FileTextOutlined className="text-xl text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Text strong className="block truncate text-sm">
                    {taskState.task.outputFile.originalName}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    {formatSize(taskState.task.outputFile.size)}
                  </Text>
                </div>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                  下载文件
                </Button>
              </div>
            </Card>
          )}

          <div className="flex justify-center gap-4 mt-4 mb-12">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="large"
              ghost
            >
              再来一次
            </Button>
          </div>
        </>
      )}

      {/* ========== 积分确认弹窗 ========== */}
      <Modal
        title="确认操作"
        open={confirmOpen}
        onOk={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
        okText={`确认，消耗 ${tool.pointsCost} 积分`}
        cancelText="取消"
        confirmLoading={isSubmitting}
        okButtonProps={{ danger: false }}
      >
        <div className="py-2">
          <div className="flex items-center justify-between mb-3">
            <Text>当前积分</Text>
            <Text strong>{user?.points ?? 0}</Text>
          </div>
          <div className="flex items-center justify-between mb-3">
            <Text>消耗积分</Text>
            <Text type="danger" strong>
              -{tool.pointsCost}
            </Text>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Text strong>剩余积分</Text>
            <Text strong className="text-primary-600">
              {(user?.points ?? 0) - tool.pointsCost}
            </Text>
          </div>
          {selectedFile && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Text type="secondary" className="text-xs">
                文件：{selectedFile.name}
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ========== 工具函数 ==========

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
