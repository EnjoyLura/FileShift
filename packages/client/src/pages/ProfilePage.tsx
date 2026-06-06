import { Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function ProfilePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <UserOutlined className="text-5xl text-primary-500 mb-4" />
      <Title level={2}>个人中心</Title>
      <Paragraph className="text-gray-400">
        个人中心将在 Step 15 中完善（用户信息、使用记录、设置）
      </Paragraph>
    </div>
  );
}
