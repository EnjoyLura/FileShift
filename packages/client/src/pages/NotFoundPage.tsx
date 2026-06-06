import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Title level={1} className="text-8xl text-gray-300 mb-4">
          404
        </Title>
        <Title level={3} className="text-gray-500 mb-2">
          页面不存在
        </Title>
        <Paragraph className="text-gray-400 mb-6">
          您访问的页面可能已被移除或地址输入有误
        </Paragraph>
        <Button type="primary" size="large" onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    </div>
  );
}
