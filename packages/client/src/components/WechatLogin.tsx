import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spin, Typography, message } from 'antd';
import { WechatOutlined, ReloadOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { get } from '@/services/api';
import type { WechatUrlResponse, WechatPollResponse } from '@fileshift/shared';

const { Text } = Typography;

/** 检测是否在微信浏览器中 */
function isWechatBrowser(): boolean {
  return /micromessenger/i.test(navigator.userAgent);
}

interface Props {
  redirectTo?: string;
}

export default function WechatLogin({ redirectTo = '/' }: Props) {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pollId, setPollId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanned' | 'expired'>('idle');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ========== 获取授权 URL ==========

  const fetchAuthUrl = useCallback(async () => {
    setLoading(true);
    setStatus('loading');

    try {
      const res = await get<WechatUrlResponse>('/v1/auth/wechat/url', { mode: 'pc' });
      if (res.code === 0 && res.data) {
        setQrUrl(res.data.url);
        if (res.data.pollId) {
          setPollId(res.data.pollId);
        }
        setStatus('idle');
      } else {
        message.error(res.message || '获取授权链接失败');
        setStatus('idle');
      }
    } catch {
      message.error('网络错误，请检查网络连接');
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== 轮询登录状态 ==========

  useEffect(() => {
    if (!pollId || status !== 'idle') return;

    // 清除旧定时器
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await get<WechatPollResponse>('/v1/auth/wechat/poll', { pollId });

        const pollData = res.data;
        if (res.code === 0 && pollData?.status === 'completed' && pollData.tokens && pollData.user) {
          // 登录成功
          clearInterval(pollInterval);
          pollTimerRef.current = null;

          login(pollData.tokens.accessToken, pollData.tokens.refreshToken, {
            id: pollData.user.id,
            nickname: pollData.user.nickname,
            avatar: pollData.user.avatar,
            points: pollData.user.points,
            vipType: pollData.user.vipType || undefined,
          });

          message.success('微信登录成功！');
          navigate(redirectTo, { replace: true });
        }
      } catch {
        // 轮询失败继续重试
      }
    }, 2000); // 每2秒轮询一次

    pollTimerRef.current = pollInterval;

    // 10分钟后自动过期
    const expireTimer = setTimeout(() => {
      setStatus('expired');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(expireTimer);
    };
  }, [pollId, status, login, navigate, redirectTo]);

  // ========== 移动端：微信内直接跳转 ==========

  const handleMobileLogin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<WechatUrlResponse>('/v1/auth/wechat/url', { mode: 'mobile' });
      if (res.code === 0 && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        message.error(res.message || '获取授权链接失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== 页面初始化 ==========

  useEffect(() => {
    if (isWechatBrowser()) {
      // 移动端微信浏览器：不自动发起，等待用户点击
      return;
    }

    // PC端：自动加载二维码
    fetchAuthUrl();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== 移动端渲染 ==========

  if (isWechatBrowser()) {
    return (
      <div className="text-center py-4">
        <WechatOutlined className="text-5xl text-green-500 mb-4" />
        <div className="mb-4">
          <Text>检测到您在微信中打开，点击下方按钮一键登录</Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<WechatOutlined />}
          loading={loading}
          onClick={handleMobileLogin}
          className="bg-green-500 border-green-500 hover:!bg-green-600 hover:!border-green-600"
        >
          微信一键登录
        </Button>
      </div>
    );
  }

  // ========== PC端渲染 ==========

  return (
    <div className="text-center py-4">
      <Spin spinning={loading} tip="正在加载二维码...">
        {/* 二维码区域 */}
        {status === 'expired' ? (
          <div className="py-8">
            <div className="text-gray-400 text-6xl mb-4">⏰</div>
            <Text type="secondary" className="block mb-4">
              二维码已过期
            </Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAuthUrl}
              loading={loading}
            >
              刷新二维码
            </Button>
          </div>
        ) : qrUrl ? (
          <div className="inline-block p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <QRCodeSVG
              value={qrUrl}
              size={200}
              level="M"
              includeMargin
            />
            <Text type="secondary" className="block mt-3 text-sm">
              请使用微信扫一扫登录
            </Text>
          </div>
        ) : (
          <div className="py-8">
            <Text type="secondary">二维码加载失败</Text>
            <div className="mt-3">
              <Button icon={<ReloadOutlined />} onClick={fetchAuthUrl} loading={loading}>
                重试
              </Button>
            </div>
          </div>
        )}
      </Spin>

      {/* 底部提示 */}
      <div className="mt-4">
        <Text type="secondary" className="text-xs">
          扫码即表示同意
          <a href="#" className="mx-1">服务协议</a>
          和
          <a href="#" className="mx-1">隐私政策</a>
        </Text>
      </div>
    </div>
  );
}
