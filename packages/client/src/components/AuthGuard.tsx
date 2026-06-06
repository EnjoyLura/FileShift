import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEffect, useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 路由守卫：未登录时重定向到登录页
 *
 * 用法:
 *   <Route element={<AuthGuard><ProtectedPage /></AuthGuard>} />
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoggedIn, loadUser } = useAuthStore();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn && !useAuthStore.getState().user) {
      // 有 Token 但无用户信息，从服务端加载
      loadUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * 仅未登录时可访问（如登录页、注册页）
 * 已登录时重定向到首页
 */
export function GuestGuard({ children }: AuthGuardProps) {
  const { isLoggedIn } = useAuthStore();

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
