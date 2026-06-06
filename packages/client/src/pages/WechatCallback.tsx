import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Typography, Result, Button } from 'antd';
import { useAuthStore } from '@/stores/useAuthStore';

const { Text } = Typography;

/**
 * 微信 OAuth 回调页面
 *
 * 后端在 /api/v1/auth/wechat/callback 处理完微信授权后，
 * 重定向到这个页面，通过 URL 参数传递 token 和用户信息。
 *
 * 此页面负责：
 * 1. 解析 URL 参数中的 token 和用户信息
 * 2. 存储到 Zustand + localStorage
 * 3. 跳转到首页
 */
export default function WechatCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userStr = searchParams.get('user');

    // 先检查是否有错误参数
    if (searchParams.get('error')) {
      setError('微信授权失败，请重试');
      return;
    }

    if (!accessToken || !refreshToken || !userStr) {
      setError('缺少登录凭证，请重新登录');
      return;
    }

    try {
      const user = JSON.parse(userStr);

      login(accessToken, refreshToken, {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        points: user.points,
        vipType: user.vipType || undefined,
      });

      // 跳转到首页
      navigate('/', { replace: true });
    } catch {
      setError('登录信息解析失败，请重试');
    }
  }, [searchParams, login, navigate]);

  // 加载中
  if (!error && searchParams.get('accessToken')) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <div className="mt-4">
            <Text type="secondary">正在完成登录...</Text>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Result
          status="error"
          title="登录失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
              返回登录页
            </Button>
          }
        />
      </div>
    );
  }

  // 默认加载状态
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spin size="large" />
    </div>
  );
}
