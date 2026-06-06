import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Avatar, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  ToolOutlined,
  UserOutlined,
  GiftOutlined,
  LogoutOutlined,
  SwapOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';
import PointsBadge from '@/components/PointsBadge';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// ========== 导航菜单项（Ant Design Menu items 格式） ==========

const menuItems: MenuProps['items'] = [
  {
    type: 'group',
    label: '导航',
    children: [
      { key: 'home', icon: <HomeOutlined />, label: '首页' },
      { key: 'tools', icon: <ToolOutlined />, label: '全部工具' },
    ],
  },
  {
    type: 'group',
    label: '工具分类',
    children: [
      { key: 'document', icon: <FileTextOutlined />, label: '文档工具' },
      { key: 'image', icon: <PictureOutlined />, label: '图片工具' },
      { key: 'media', icon: <VideoCameraOutlined />, label: '音视频工具' },
    ],
  },
];

/** 移动端底部导航 */
const mobileNavItems: { key: string; icon: React.ReactNode; label: string; path: string }[] = [
  { key: 'home', icon: <HomeOutlined />, label: '首页', path: '/' },
  { key: 'tools', icon: <SwapOutlined />, label: '工具', path: '/tools' },
  { key: 'points', icon: <GiftOutlined />, label: '积分', path: '/points' },
  { key: 'profile', icon: <UserOutlined />, label: '我的', path: '/profile' },
];

// ========== 主布局组件 ==========

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuthStore();

  // PC 端侧边栏折叠状态
  const [collapsed, setCollapsed] = useState(false);
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 确定当前选中的菜单 key
  const currentKey = (() => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/tools')) return 'tools';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/points')) return 'points';
    if (path.startsWith('/login')) return 'login';
    return '';
  })();

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/profile') },
    { key: 'points', icon: <GiftOutlined />, label: '积分中心', onClick: () => navigate('/points') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: logout },
  ];

  // ========== 移动端布局 ==========

  if (isMobile) {
    return (
      <Layout className="min-h-screen">
        {/* 顶部导航栏 */}
        <Header className="flex items-center justify-between bg-white px-4 shadow-sm h-12 leading-[48px]">
          <Text strong className="text-primary-600 text-base" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            FileShift
          </Text>
          {isLoggedIn ? (
            <PointsBadge />
          ) : (
            <Button type="primary" size="small" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
              登录
            </Button>
          )}
        </Header>

        {/* 内容区 */}
        <Content className="p-4 pb-16 bg-gray-50">
          <Outlet />
        </Content>

        {/* 底部导航栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-1 z-50">
          {mobileNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center px-3 py-1 min-w-[60px] transition-colors ${
                currentKey === item.key ? 'text-primary-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </Layout>
    );
  }

  // ========== PC 端布局 ==========

  return (
    <Layout className="min-h-screen">
      {/* 侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        theme="light"
        className="shadow-sm border-r border-gray-100"
        style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}
      >
        {/* Logo 区 */}
        <div
          className="flex items-center justify-center h-16 cursor-pointer border-b border-gray-100"
          onClick={() => navigate('/')}
        >
          {collapsed ? (
            <SwapOutlined className="text-2xl text-primary-500" />
          ) : (
            <Text strong className="text-primary-600 text-lg">
              FileShift
            </Text>
          )}
        </div>

        {/* 主导航 */}
        <Menu
          mode="inline"
          selectedKeys={[currentKey]}
          onClick={({ key }) => {
            const routeMap: Record<string, string> = {
              home: '/',
              tools: '/tools',
              document: '/tools?category=DOCUMENT',
              image: '/tools?category=IMAGE',
              media: '/tools?category=MEDIA',
              profile: '/profile',
              points: '/points',
            };
            const path = routeMap[key];
            if (path) navigate(path);
          }}
          items={menuItems}
          className="border-r-0 mt-2"
        />

        {/* 用户区 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-4">
          {isLoggedIn && user ? (
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
              <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
                <div className="flex items-center gap-2 cursor-pointer">
                  <Avatar size="small" icon={<UserOutlined />} className="bg-primary-500" />
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{user.nickname || '用户'}</div>
                      <PointsBadge size={14} clickable={false} />
                    </div>
                  )}
                </div>
              </Dropdown>
            </div>
          ) : (
            <Button
              type="primary"
              block={!collapsed}
              icon={<LoginOutlined />}
              onClick={() => navigate('/login')}
              size={collapsed ? 'small' : 'middle'}
            >
              {!collapsed && '登录 / 注册'}
            </Button>
          )}
        </div>
      </Sider>

      {/* 主内容区 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header className="flex items-center bg-white px-6 shadow-sm h-14 leading-[56px]">
          <Text type="secondary">文件格式，一键切换</Text>
        </Header>
        <Content className="p-6 bg-gray-50 min-h-[calc(100vh-56px)]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
