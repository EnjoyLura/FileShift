import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Title level={2}>登录 / 注册</Title>
        <Paragraph className="text-gray-400">
          登录页面将在 Step 12 中完善（邮箱登录、手机号登录、注册）
        </Paragraph>
      </div>
    </div>
  );
}
