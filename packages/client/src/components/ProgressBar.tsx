import { Progress, Typography, Alert } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { TaskStatus } from '@fileshift/shared';

const { Text } = Typography;

// ========== Props ==========

interface ProgressBarProps {
  status: TaskStatus | null;
  progress: number; // 0-100
  errorMessage?: string | null;
  pointsConsumed?: number;
}

// ========== 状态配置 ==========

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
}

const statusConfigMap: Record<string, StatusConfig> = {
  [TaskStatus.PENDING]: {
    icon: <ClockCircleOutlined className="text-2xl text-yellow-500" />,
    color: '#faad14',
    label: '排队等待中',
    description: '任务已提交，正在等待处理…',
  },
  [TaskStatus.PROCESSING]: {
    icon: <LoadingOutlined className="text-2xl text-blue-500" spin />,
    color: '#1677ff',
    label: '正在处理',
    description: '文件正在转换中，请耐心等待',
  },
  [TaskStatus.COMPLETED]: {
    icon: <CheckCircleOutlined className="text-2xl text-green-500" />,
    color: '#52c41a',
    label: '处理完成',
    description: '文件转换成功，可以下载了',
  },
  [TaskStatus.FAILED]: {
    icon: <CloseCircleOutlined className="text-2xl text-red-500" />,
    color: '#ff4d4f',
    label: '处理失败',
    description: '文件转换过程中出现错误',
  },
};

/**
 * ProgressBar — 任务处理进度展示组件
 *
 * 根据 TaskStatus 展示不同阶段的图标、进度条、状态文字。
 * 处理完成时显示积分消耗，失败时显示错误详情。
 */
export default function ProgressBar({
  status,
  progress,
  errorMessage,
  pointsConsumed,
}: ProgressBarProps) {
  if (!status) return null;

  const config = statusConfigMap[status] ?? statusConfigMap[TaskStatus.PENDING];

  // ========== 处理中 / 等待中 ==========

  if (status === TaskStatus.PENDING || status === TaskStatus.PROCESSING) {
    return (
      <div className="border border-gray-200 rounded-xl p-6 bg-white">
        <div className="flex items-center gap-4 mb-4">
          {config.icon}
          <div>
            <Text strong className="block text-base">
              {config.label}
            </Text>
            <Text type="secondary" className="text-sm">
              {config.description}
            </Text>
          </div>
        </div>
        <Progress
          percent={progress}
          status="active"
          strokeColor={{ from: '#1677ff', to: '#52c41a' }}
          showInfo={progress > 0}
          format={(p) => `${p}%`}
        />
      </div>
    );
  }

  // ========== 处理完成 ==========

  if (status === TaskStatus.COMPLETED) {
    return (
      <div className="border border-green-200 rounded-xl p-6 bg-green-50">
        <div className="flex items-center gap-4 mb-3">
          {config.icon}
          <div>
            <Text strong className="block text-base text-green-700">
              {config.label}
            </Text>
            <Text type="secondary" className="text-sm">
              {config.description}
            </Text>
          </div>
        </div>
        <Progress percent={100} status="success" showInfo={false} />
        {pointsConsumed !== undefined && (
          <Text type="secondary" className="text-xs mt-2 block">
            已消耗 {pointsConsumed} 积分
          </Text>
        )}
      </div>
    );
  }

  // ========== 处理失败 ==========

  return (
    <div className="border border-red-200 rounded-xl p-6 bg-red-50">
      <div className="flex items-center gap-4 mb-3">
        {config.icon}
        <div>
          <Text strong className="block text-base text-red-700">
            {config.label}
          </Text>
          <Text type="secondary" className="text-sm">
            {config.description}
          </Text>
        </div>
      </div>
      <Progress percent={progress} status="exception" showInfo={false} />
      {errorMessage && (
        <Alert
          message={errorMessage}
          type="error"
          showIcon
          className="mt-3"
          style={{ fontSize: '13px' }}
        />
      )}
    </div>
  );
}
