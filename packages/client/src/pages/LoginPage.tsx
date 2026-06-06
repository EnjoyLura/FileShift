import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Tabs, Typography, message, Progress, Card, Space } from 'antd';
import {
  MailOutlined,
  MobileOutlined,
  LockOutlined,
  UserOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCountdown } from '@/hooks/useCountdown';
import { post } from '@/services/api';
import type { AuthResponse } from '@fileshift/shared';

const { Title, Text, Link } = Typography;

// ========== 密码强度评估 ==========

interface StrengthResult {
  score: number; // 0-4
  percent: number; // 0-100
  status: 'exception' | 'active' | 'normal' | 'success';
  label: string;
}

function evaluatePasswordStrength(password: string): StrengthResult {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const map: Record<number, Pick<StrengthResult, 'status' | 'label'>> = {
    0: { status: 'exception', label: '太弱' },
    1: { status: 'exception', label: '弱' },
    2: { status: 'active', label: '一般' },
    3: { status: 'normal', label: '强' },
    4: { status: 'success', label: '很强' },
    5: { status: 'success', label: '极强' },
  };

  return {
    score: Math.min(score, 5),
    percent: (Math.min(score, 5) / 5) * 100,
    ...map[Math.min(score, 5)],
  };
}

// ========== 主组件 ==========

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const { login } = useAuthStore();
  const { countdown, start: startCountdown } = useCountdown(60);

  // 顶层 Tab：登录 / 注册
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  // 登录子 Tab：邮箱 / 手机号
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);

  // 密码强度（注册用）
  const [passwordStrength, setPasswordStrength] = useState<StrengthResult | null>(null);

  // ========== 登录成功后处理 ==========

  const handleLoginSuccess = useCallback(
    (data: AuthResponse) => {
      login(data.tokens.accessToken, data.tokens.refreshToken, {
        id: data.user.id,
        nickname: data.user.nickname,
        avatar: data.user.avatar,
        points: data.user.points,
        vipType: data.user.vipType || undefined,
      });
      message.success(`登录成功，欢迎回来！`);
      navigate(redirectTo, { replace: true });
    },
    [login, navigate, redirectTo]
  );

  // ========== 邮箱登录 ==========

  const handleEmailLogin = useCallback(
    async (values: { email: string; password: string }) => {
      setLoading(true);
      try {
        const res = await post<AuthResponse>('/v1/auth/login/email', values);
        if (res.code === 0 && res.data) {
          handleLoginSuccess(res.data);
        } else {
          message.error(res.message || '登录失败，请重试');
        }
      } catch {
        message.error('网络错误，请检查网络连接');
      } finally {
        setLoading(false);
      }
    },
    [handleLoginSuccess]
  );

  // ========== 发送短信验证码 ==========

  const handleSendSms = useCallback(
    async (phone: string) => {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        message.warning('请输入正确的手机号');
        return;
      }

      setSmsLoading(true);
      try {
        const res = await post<{ message: string; devCode?: string }>('/v1/auth/sms/send', {
          phone,
        });
        if (res.code === 0) {
          startCountdown();
          message.success('验证码已发送');
          // 开发环境自动填充验证码
          if (res.data?.devCode) {
            message.info(`[DEV] 验证码：${res.data.devCode}`);
          }
        } else {
          message.error(res.message || '发送失败，请稍后重试');
        }
      } catch {
        message.error('网络错误，请检查网络连接');
      } finally {
        setSmsLoading(false);
      }
    },
    [startCountdown]
  );

  // ========== 手机号登录 ==========

  const handlePhoneLogin = useCallback(
    async (values: { phone: string; code: string }) => {
      setLoading(true);
      try {
        const res = await post<AuthResponse>('/v1/auth/login/phone', values);
        if (res.code === 0 && res.data) {
          handleLoginSuccess(res.data);
        } else {
          message.error(res.message || '登录失败，请重试');
        }
      } catch {
        message.error('网络错误，请检查网络连接');
      } finally {
        setLoading(false);
      }
    },
    [handleLoginSuccess]
  );

  // ========== 邮箱注册 ==========

  const handleRegister = useCallback(
    async (values: {
      email: string;
      password: string;
      confirmPassword: string;
      inviteCode?: string;
    }) => {
      if (values.password !== values.confirmPassword) {
        message.warning('两次输入的密码不一致');
        return;
      }

      setLoading(true);
      try {
        const res = await post<AuthResponse>('/v1/auth/register', {
          email: values.email,
          password: values.password,
          inviteCode: values.inviteCode || undefined,
        });
        if (res.code === 0 && res.data) {
          login(res.data.tokens.accessToken, res.data.tokens.refreshToken, {
            id: res.data.user.id,
            nickname: res.data.user.nickname,
            avatar: res.data.user.avatar,
            points: res.data.user.points,
            vipType: res.data.user.vipType || undefined,
          });
          message.success('注册成功，已赠送 50 积分！🎉', 4);
          navigate(redirectTo, { replace: true });
        } else {
          message.error(res.message || '注册失败，请重试');
        }
      } catch {
        message.error('网络错误，请检查网络连接');
      } finally {
        setLoading(false);
      }
    },
    [login, navigate, redirectTo]
  );

  // ========== 邮箱登录表单 ==========

  const emailLoginForm = (
    <Form layout="vertical" size="large" onFinish={handleEmailLogin} autoComplete="off">
      <Form.Item
        name="email"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '邮箱格式不正确' },
        ]}
      >
        <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="请输入邮箱" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少 8 位' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="text-gray-400" />}
          placeholder="请输入密码"
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block className="h-11 text-base">
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  // ========== 注册表单 ==========

  const [registerForm] = Form.useForm();

  const registerFormElement = (
    <Form
      form={registerForm}
      layout="vertical"
      size="large"
      onFinish={handleRegister}
      onValuesChange={(changed) => {
        if ('password' in changed) {
          setPasswordStrength(changed.password ? evaluatePasswordStrength(changed.password) : null);
        }
      }}
      autoComplete="off"
    >
      <Form.Item
        name="email"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '邮箱格式不正确' },
        ]}
      >
        <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="请输入邮箱" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少 8 位' },
          {
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
            message: '需包含大小写字母和数字',
          },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="text-gray-400" />}
          placeholder="请设置密码（8位以上，含大小写字母和数字）"
        />
      </Form.Item>

      {/* 密码强度指示 */}
      {passwordStrength && (
        <div className="mb-4 -mt-2">
          <Progress
            percent={passwordStrength.percent}
            status={passwordStrength.status}
            showInfo={false}
            size="small"
            strokeColor={
              passwordStrength.score <= 1
                ? '#ff4d4f'
                : passwordStrength.score <= 2
                  ? '#faad14'
                  : '#52c41a'
            }
          />
          <Text type="secondary" className="text-xs">
            密码强度：{passwordStrength.label}
            {passwordStrength.score < 3 && '（建议使用大小写字母+数字+符号组合）'}
          </Text>
        </div>
      )}

      <Form.Item
        name="confirmPassword"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="text-gray-400" />}
          placeholder="请再次输入密码"
        />
      </Form.Item>

      <Form.Item name="inviteCode">
        <Input prefix={<GiftOutlined className="text-gray-400" />} placeholder="邀请码（选填）" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block className="h-11 text-base">
          注册
        </Button>
      </Form.Item>
    </Form>
  );

  // ========== 渲染 ==========

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg" styles={{ body: { padding: '32px 28px' } }}>
        {/* 标题 */}
        <div className="text-center mb-6">
          <Title level={3} className="!mb-1">
            {activeTab === 'login' ? '欢迎回来' : '创建账号'}
          </Title>
          <Text type="secondary">
            {activeTab === 'login'
              ? '登录你的 FileShift 账号'
              : '注册 FileShift 账号，开启文件转换之旅'}
          </Text>
        </div>

        {/* 顶层 Tab */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'login' | 'register');
            setPasswordStrength(null);
            registerForm.resetFields();
          }}
          centered
          items={[
            {
              key: 'login',
              label: (
                <span className="px-4">
                  <UserOutlined className="mr-1" />
                  登录
                </span>
              ),
              children: (
                <div>
                  {/* 登录方式切换 */}
                  <Tabs
                    activeKey={loginMode}
                    onChange={(key) => setLoginMode(key as 'email' | 'phone')}
                    centered
                    size="small"
                    items={[
                      {
                        key: 'email',
                        label: (
                          <span>
                            <MailOutlined className="mr-1" />
                            邮箱登录
                          </span>
                        ),
                        children: emailLoginForm,
                      },
                      {
                        key: 'phone',
                        label: (
                          <span>
                            <MobileOutlined className="mr-1" />
                            手机号登录
                          </span>
                        ),
                        children: (
                          <div className="phone-login-form">
                            {/* 手机号登录需要获取 form 实例来发送验证码 */}
                            <Form
                              layout="vertical"
                              size="large"
                              onFinish={handlePhoneLogin}
                              autoComplete="off"
                            >
                              <Form.Item
                                name="phone"
                                rules={[
                                  { required: true, message: '请输入手机号' },
                                  { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
                                ]}
                              >
                                <Input
                                  id="phone-input"
                                  prefix={<MobileOutlined className="text-gray-400" />}
                                  placeholder="请输入手机号"
                                  maxLength={11}
                                />
                              </Form.Item>

                              <Form.Item
                                name="code"
                                rules={[
                                  { required: true, message: '请输入验证码' },
                                  { len: 6, message: '验证码为 6 位数字' },
                                ]}
                              >
                                <Space.Compact block>
                                  <Input
                                    prefix={<LockOutlined className="text-gray-400" />}
                                    placeholder="请输入验证码"
                                    maxLength={6}
                                    style={{ flex: 1 }}
                                  />
                                  <Button
                                    type="default"
                                    disabled={countdown > 0}
                                    loading={smsLoading}
                                    onClick={() => {
                                      const phoneInput = document.getElementById(
                                        'phone-input'
                                      ) as HTMLInputElement | null;
                                      const phone = phoneInput?.value || '';
                                      handleSendSms(phone);
                                    }}
                                    className="min-w-[120px]"
                                  >
                                    {countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
                                  </Button>
                                </Space.Compact>
                              </Form.Item>

                              <Form.Item>
                                <Button
                                  type="primary"
                                  htmlType="submit"
                                  loading={loading}
                                  block
                                  className="h-11 text-base"
                                >
                                  登录
                                </Button>
                              </Form.Item>
                            </Form>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'register',
              label: (
                <span className="px-4">
                  <UserOutlined className="mr-1" />
                  注册
                </span>
              ),
              children: registerFormElement,
            },
          ]}
        />

        {/* 底部提示 */}
        <div className="text-center mt-2">
          <Text type="secondary" className="text-xs">
            {activeTab === 'login' ? (
              <>
                还没有账号？
                <Link onClick={() => setActiveTab('register')} className="text-xs">
                  立即注册
                </Link>
              </>
            ) : (
              <>
                已有账号？
                <Link onClick={() => setActiveTab('login')} className="text-xs">
                  立即登录
                </Link>
              </>
            )}
          </Text>
        </div>
      </Card>
    </div>
  );
}
