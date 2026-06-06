import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button } from 'antd';
import { ArrowLeftOutlined, ToolOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 工具详情/操作页（占位）
 *
 * Step 14 将实现完整的文件上传、参数设置、任务提交、进度展示功能。
 */
export default function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        返回
      </Button>

      <div className="text-center py-20">
        <ToolOutlined className="text-5xl text-primary-400 mb-4" />
        <Title level={3}>工具操作页</Title>
        <Text type="secondary" className="block mb-2">
          工具 ID：{id}
        </Text>
        <Text type="secondary" className="block mb-6">
          文件上传、参数配置、任务提交等功能将在 Step 14 中实现
        </Text>
        <Button type="primary" onClick={() => navigate('/tools')}>
          浏览全部工具
        </Button>
      </div>
    </div>
  );
}
