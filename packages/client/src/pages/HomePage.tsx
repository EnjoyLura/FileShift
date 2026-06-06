import { useState, useEffect, useMemo, useCallback } from 'react';
import { Typography, Input, Tabs, Row, Col, Spin, Empty } from 'antd';
import { SearchOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { ToolConfig } from '@fileshift/shared';
import { ToolCategory } from '@fileshift/shared';
import { get } from '@/services/api';
import ToolCard from '@/components/ToolCard';

const { Title, Paragraph } = Typography;

// ========== 热门推荐的工具 ID 列表 ==========

const FEATURED_TOOL_IDS = [
  'image-compress',
  'jpg-to-png',
  'png-to-jpg',
  'pdf-to-word',
  'word-to-pdf',
  'pdf-merge',
  'video-compress',
  'pdf-split',
];

// ========== 分类 Tab 定义 ==========

type TabKey = 'all' | 'DOCUMENT' | 'IMAGE' | 'MEDIA';

interface CategoryTab {
  key: TabKey;
  label: string;
  categories: ToolCategory[];
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all', label: '全部', categories: [] },
  { key: 'DOCUMENT', label: '文档', categories: [ToolCategory.DOCUMENT] },
  { key: 'IMAGE', label: '图片', categories: [ToolCategory.IMAGE] },
  { key: 'MEDIA', label: '音视频', categories: [ToolCategory.AUDIO, ToolCategory.VIDEO] },
];

// ========== HomePage ==========

export default function HomePage() {
  // 工具数据
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // UI 状态
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [keyword, setKeyword] = useState('');

  // ========== 获取工具列表 ==========

  useEffect(() => {
    let cancelled = false;

    async function fetchTools() {
      setLoading(true);
      try {
        const res = await get<ToolConfig[]>('/v1/tools');
        if (!cancelled && res.code === 0 && res.data) {
          // 排除 mock-tool
          const filtered = res.data.filter((t) => t.id !== 'mock-tool');
          setTools(filtered);
        }
      } catch {
        // 请求失败时使用空列表（开发环境 Mock 降级）
        if (!cancelled) setTools([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTools();
    return () => {
      cancelled = true;
    };
  }, []);

  // ========== 热门推荐工具 ==========

  const featuredTools = useMemo(() => {
    return FEATURED_TOOL_IDS.map((id) => tools.find((t) => t.id === id)).filter(
      Boolean
    ) as ToolConfig[];
  }, [tools]);

  // ========== 筛选后的工具列表 ==========

  const filteredTools = useMemo(() => {
    let result = tools;

    // 分类筛选
    if (activeTab !== 'all') {
      const tab = CATEGORY_TABS.find((t) => t.key === activeTab);
      if (tab) {
        result = result.filter((t) => tab.categories.includes(t.category));
      }
    }

    // 关键词搜索
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw) ||
          t.id.toLowerCase().includes(kw)
      );
    }

    return result;
  }, [tools, activeTab, keyword]);

  // ========== 搜索处理 ==========

  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
  }, []);

  // ========== 渲染内容 ==========

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const showFeatured = activeTab === 'all' && !keyword.trim() && featuredTools.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* ========== Banner ========== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600 px-6 py-10 sm:px-10 sm:py-14 mb-8 text-white">
        {/* 装饰背景 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-4 w-32 h-32 rounded-full bg-white" />
        </div>

        <div className="relative z-10">
          <Title level={1} className="!text-white !text-2xl sm:!text-3xl !mb-2">
            FileShift
          </Title>
          <Paragraph className="!text-white/80 !text-sm sm:!text-base !mb-6 max-w-lg">
            文件格式，一键切换 — 支持文档、图片、音视频格式转换，无需安装任何软件
          </Paragraph>

          {/* 搜索框 */}
          <div className="max-w-md">
            <Input
              size="large"
              placeholder="搜索工具名称、描述..."
              prefix={<SearchOutlined className="text-white/60" />}
              allowClear
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
              className="!bg-white/15 !border-white/20 !text-white placeholder:!text-white/50 hover:!bg-white/25"
              classNames={{ input: '!text-white placeholder:!text-white/50' }}
            />
          </div>
        </div>
      </div>

      {/* ========== 热门推荐 ========== */}
      {showFeatured && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <ThunderboltOutlined className="text-lg text-amber-500" />
            <Title level={4} className="!mb-0">
              热门推荐
            </Title>
          </div>
          <Row gutter={[16, 16]}>
            {featuredTools.map((tool) => (
              <Col key={tool.id} xs={12} sm={8} md={6} lg={6}>
                <ToolCard tool={tool} featured />
              </Col>
            ))}
          </Row>
        </section>
      )}

      {/* ========== 分类 Tab + 工具网格 ========== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ExperimentOutlined className="text-lg text-primary-500" />
            <Title level={4} className="!mb-0">
              全部工具
            </Title>
          </div>
          <span className="text-xs text-gray-400">{filteredTools.length} 个工具</span>
        </div>

        {/* 分类 Tab */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          className="mb-4"
          items={CATEGORY_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />

        {/* 工具网格 */}
        {filteredTools.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredTools.map((tool) => (
              <Col key={tool.id} xs={24} sm={12} md={8} lg={6}>
                <ToolCard tool={tool} />
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            description={keyword.trim() ? `未找到与"${keyword}"相关的工具` : '暂无工具'}
            className="py-16"
          >
            {keyword.trim() && (
              <a onClick={() => setKeyword('')} className="text-primary-500 cursor-pointer">
                清除搜索
              </a>
            )}
          </Empty>
        )}
      </section>
    </div>
  );
}
