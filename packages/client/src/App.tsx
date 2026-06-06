import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthGuard, GuestGuard } from '@/components/AuthGuard';

// 懒加载页面组件
const HomePage = lazy(() => import('@/pages/HomePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ToolsPage = lazy(() => import('@/pages/ToolsPage'));
const ToolDetailPage = lazy(() => import('@/pages/ToolDetailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const PointsPage = lazy(() => import('@/pages/PointsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** 页面加载中占位 */
function PageLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

/**
 * FileShift 路由配置
 *
 * 页面路由表:
 *   /              → 首页（公开）
 *   /login         → 登录/注册（仅未登录可访问）
 *   /tools         → 全部工具（公开）
 *   /tools/:id     → 工具详情/操作页（认证后，Step 14）
 *   /profile       → 个人中心（认证后）
 *   /points        → 积分中心（认证后）
 *   *              → 404
 */
function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* 主布局包裹的路由 */}
        <Route element={<MainLayout />}>
          {/* 公开页面 */}
          <Route index element={<HomePage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route
            path="tools/:id"
            element={
              <AuthGuard>
                <ToolDetailPage />
              </AuthGuard>
            }
          />

          {/* 仅未登录可访问 */}
          <Route
            path="login"
            element={
              <GuestGuard>
                <LoginPage />
              </GuestGuard>
            }
          />

          {/* 需要登录的页面 */}
          <Route
            path="profile"
            element={
              <AuthGuard>
                <ProfilePage />
              </AuthGuard>
            }
          />
          <Route
            path="points"
            element={
              <AuthGuard>
                <PointsPage />
              </AuthGuard>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
