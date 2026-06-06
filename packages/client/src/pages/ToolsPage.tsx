import { Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function ToolsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <ToolOutlined className="text-5xl text-primary-500 mb-4" />
      <Title level={2}>全部工具</Title>
      <Paragraph className="text-gray-400">
        工具列表将在 Step 13 中完善（分类 Tab、工具卡片、搜索）
      </Paragraph>
    </div>
  );
}
