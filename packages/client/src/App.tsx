import { Routes, Route } from 'react-router-dom';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <Title level={1} className="text-primary-600">
        FileShift
      </Title>
      <Paragraph className="text-lg text-gray-500 text-center">
        文件格式，一键切换
      </Paragraph>
      <Paragraph className="text-gray-400 mt-4">
        首页将在 Step 13 中完善
      </Paragraph>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Title level={2}>登录页面（Step 12）</Title>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <Title level={2}>404 - 页面不存在</Title>
        </div>
      } />
    </Routes>
  );
}

export default App;
