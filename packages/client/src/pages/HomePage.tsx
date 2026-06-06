import { Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <HomeOutlined className="text-6xl text-primary-500 mb-6" />
      <Title level={1} className="text-primary-600 mb-2">
        FileShift
      </Title>
      <Paragraph className="text-lg text-gray-500 text-center mb-8">
        文件格式，一键切换 — 支持文档、图片、音视频格式转换
      </Paragraph>
      <Paragraph className="text-gray-400">
        首页内容将在 Step 13 中完善（工具列表、分类筛选、搜索）
      </Paragraph>
    </div>
  );
}
