import { Typography } from 'antd';
import { GiftOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function PointsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <GiftOutlined className="text-5xl text-primary-500 mb-4" />
      <Title level={2}>积分中心</Title>
      <Paragraph className="text-gray-400">
        积分中心将在 Step 15 中完善（余额、流水、套餐、签到）
      </Paragraph>
    </div>
  );
}
