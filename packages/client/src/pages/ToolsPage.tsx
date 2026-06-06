import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography, Input, Tabs, Row, Col, Spin, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ToolConfig } from '@fileshift/shared';
import { ToolCategory } from '@fileshift/shared';
import { get } from '@/services/api';
import ToolCard from '@/components/ToolCard';

const { Title } = Typography;

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

/**
 * 全部工具页面
 *
 * 支持分类 Tab 切换、关键词搜索、URL 参数初始化分类。
 * 点击工具卡片跳转至工具操作页（Step 14 实现）。
 */
export default function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 参数初始化分类
  const initialCategory = (searchParams.get('category') as TabKey) || 'all';

  // 工具数据
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // UI 状态
  const [activeTab, setActiveTab] = useState<TabKey>(initialCategory);
  const [keyword, setKeyword] = useState('');

  // ========== 获取工具列表 ==========

  useEffect(() => {
    let cancelled = false;

    async function fetchTools() {
      setLoading(true);
      try {
        const res = await get<ToolConfig[]>('/v1/tools');
        if (!cancelled && res.code === 0 && res.data) {
          setTools(res.data.filter((t) => t.id !== 'mock-tool'));
        }
      } catch {
        if (!cancelled) setTools([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTools();
    return () => { cancelled = true; };
  }, []);

  // ========== 筛选 ==========

  const filteredTools = useMemo(() => {
    let result = tools;

    if (activeTab !== 'all') {
      const tab = CATEGORY_TABS.find((t) => t.key === activeTab);
      if (tab) {
        result = result.filter((t) => tab.categories.includes(t.category));
      }
    }

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

  // ========== 事件处理 ==========

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey);
    setSearchParams(key !== 'all' ? { category: key } : {}, { replace: true });
  }, [setSearchParams]);

  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
  }, []);

  // ========== 渲染 ==========

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <Title level={3} className="!mb-1">
          全部工具
        </Title>
        <span className="text-sm text-gray-400">
          共 {filteredTools.length} 个工具可用
        </span>
      </div>

      {/* 搜索框 */}
      <div className="mb-4 max-w-sm">
        <Input
          size="large"
          placeholder="搜索工具名称、描述..."
          prefix={<SearchOutlined className="text-gray-400" />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* 分类 Tab */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
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
    </div>
  );
}
