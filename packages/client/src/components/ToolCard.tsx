import { useNavigate } from 'react-router-dom';
import { Card, Tag, Typography } from 'antd';
import {
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ToolConfig } from '@fileshift/shared';
import { ToolCategory } from '@fileshift/shared';

const { Text, Paragraph } = Typography;

// ========== 分类 → 图标映射 ==========

const categoryIconMap: Record<string, React.ReactNode> = {
  [ToolCategory.DOCUMENT]: <FileTextOutlined className="text-2xl text-orange-500" />,
  [ToolCategory.IMAGE]: <PictureOutlined className="text-2xl text-green-500" />,
  [ToolCategory.VIDEO]: <VideoCameraOutlined className="text-2xl text-blue-500" />,
  [ToolCategory.AUDIO]: <AudioOutlined className="text-2xl text-purple-500" />,
};

const categoryColorMap: Record<string, string> = {
  [ToolCategory.DOCUMENT]: 'orange',
  [ToolCategory.IMAGE]: 'green',
  [ToolCategory.VIDEO]: 'blue',
  [ToolCategory.AUDIO]: 'purple',
};

const categoryLabelMap: Record<string, string> = {
  [ToolCategory.DOCUMENT]: '文档',
  [ToolCategory.IMAGE]: '图片',
  [ToolCategory.VIDEO]: '视频',
  [ToolCategory.AUDIO]: '音频',
};

// ========== 格式化文件大小 ==========

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

// ========== ToolCard Props ==========

interface ToolCardProps {
  tool: ToolConfig;
  featured?: boolean;
}

/**
 * 工具卡片组件
 *
 * 展示单个转换工具的图标、名称、描述、积分消耗等信息。
 * 点击跳转至工具操作页（Step 14 实现）。
 */
export default function ToolCard({ tool, featured }: ToolCardProps) {
  const navigate = useNavigate();
  const icon = categoryIconMap[tool.category] ?? (
    <SwapOutlined className="text-2xl text-gray-400" />
  );
  const categoryColor = categoryColorMap[tool.category] ?? 'default';
  const categoryLabel = categoryLabelMap[tool.category] ?? tool.category;

  return (
    <Card
      hoverable
      className={`tool-card transition-all duration-200 h-full ${featured ? 'border-primary-300 shadow-primary-100' : ''}`}
      styles={{
        body: { padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' },
      }}
      onClick={() => navigate(`/tools/${tool.id}`)}
    >
      {/* 图标 + 分类标签 */}
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
        <Tag color={categoryColor} className="m-0 text-xs">
          {categoryLabel}
        </Tag>
      </div>

      {/* 工具名称 */}
      <Text strong className="text-base mb-1 block truncate">
        {tool.name}
      </Text>

      {/* 描述 */}
      <Paragraph
        type="secondary"
        className="text-xs mb-3 flex-1"
        ellipsis={{ rows: 2 }}
        style={{ marginBottom: 0 }}
      >
        {tool.description}
      </Paragraph>

      {/* 底部信息：积分 + 文件大小限制 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <Text className="text-xs text-primary-600 font-medium">{tool.pointsCost} 积分</Text>
        <Text type="secondary" className="text-xs">
          ≤ {formatFileSize(tool.maxFileSize)}
        </Text>
      </div>
    </Card>
  );
}
