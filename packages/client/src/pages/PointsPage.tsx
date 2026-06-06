import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  message,
} from 'antd';
import { GiftOutlined, CalendarOutlined, RiseOutlined, CrownOutlined } from '@ant-design/icons';
import { PointsTransactionType } from '@fileshift/shared';
import type {
  PaginatedResponse,
  PointsBalance,
  PointsTransaction,
  PointsPackage,
} from '@fileshift/shared';
import { get, post } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';

const { Title, Text } = Typography;

// ========== 交易类型标签 ==========

const typeLabelMap: Record<string, { label: string; color: string }> = {
  [PointsTransactionType.REGISTER_BONUS]: { label: '注册赠送', color: 'green' },
  [PointsTransactionType.SIGN_IN]: { label: '每日签到', color: 'blue' },
  [PointsTransactionType.INVITE_REWARD]: { label: '邀请奖励', color: 'purple' },
  [PointsTransactionType.PURCHASE]: { label: '积分购买', color: 'gold' },
  [PointsTransactionType.CONSUME]: { label: '工具消耗', color: 'orange' },
  [PointsTransactionType.REFUND]: { label: '失败退还', color: 'cyan' },
  [PointsTransactionType.VIP_MONTHLY]: { label: 'VIP月赠', color: 'magenta' },
  [PointsTransactionType.PROFILE_BONUS]: { label: '完善资料', color: 'lime' },
};

// ========== 时间格式化 ==========

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ========== PointsPage ==========

export default function PointsPage() {
  const { user, updatePoints } = useAuthStore();

  // 积分余额
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // 签到状态
  const [signingIn, setSigningIn] = useState(false);
  const [signedToday, setSignedToday] = useState(false);

  // 交易流水
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  // 积分套餐
  const [packages, setPackages] = useState<PointsPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(false);

  // ========== 加载积分余额 ==========

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await get<PointsBalance>('/v1/points/balance');
      if (res.code === 0 && res.data) {
        setBalance(res.data);
        updatePoints(res.data.balance);
      }
    } catch {
      /* ignore */
    } finally {
      setBalanceLoading(false);
    }
  }, [updatePoints]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // ========== 加载交易流水 ==========

  const loadTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await get<PaginatedResponse<PointsTransaction>>('/v1/points/transactions', {
        page,
        pageSize: 10,
      });
      if (res.code === 0 && res.data) {
        setTransactions(res.data.list);
        setTxTotal(res.data.total);
      }
    } catch {
      /* ignore */
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(txPage);
  }, [txPage, loadTransactions]);

  // ========== 加载积分套餐 ==========

  useEffect(() => {
    setPkgLoading(true);
    get<PointsPackage[]>('/v1/points/packages')
      .then((res) => {
        if (res.code === 0 && res.data) setPackages(res.data);
      })
      .catch(() => {})
      .finally(() => setPkgLoading(false));
  }, []);

  // ========== 每日签到 ==========

  const handleSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      const res = await post<{
        pointsEarned: number;
        consecutiveDays: number;
        bonusEarned: number;
      }>('/v1/points/sign-in');
      if (res.code === 0 && res.data) {
        setSignedToday(true);
        message.success(res.message || '签到成功');
        // 刷新余额
        await loadBalance();
      } else {
        message.error(res.message || '签到失败');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      message.error(axiosErr?.response?.data?.message || '签到失败');
    } finally {
      setSigningIn(false);
    }
  }, [loadBalance]);

  // ========== 渲染 ==========

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <Title level={4} className="!mb-6">
        积分中心
      </Title>

      {/* ===== 积分余额卡片 ===== */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12}>
          <Card loading={balanceLoading}>
            <Statistic
              title="当前积分"
              value={balance?.balance ?? user?.points ?? 0}
              prefix={<GiftOutlined className="text-primary-500" />}
              valueStyle={{ color: '#1677ff' }}
            />
            {balance?.vipType && (
              <Text type="secondary" className="text-xs">
                <CrownOutlined className="mr-1 text-yellow-500" />
                VIP 折扣：{(balance.vipDiscount * 100).toFixed(0)}%
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="block">
                  每日签到
                </Text>
                <Text type="secondary" className="text-xs">
                  签到可获积分奖励
                </Text>
              </div>
              <Button
                type="primary"
                icon={<CalendarOutlined />}
                onClick={handleSignIn}
                loading={signingIn}
                disabled={signedToday}
              >
                {signedToday ? '今日已签到' : '签到'}
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ===== 积分套餐 ===== */}
      <Card
        title={
          <span>
            <RiseOutlined className="mr-2" />
            积分套餐
          </span>
        }
        className="mb-6"
      >
        {pkgLoading ? (
          <Spin />
        ) : packages.length === 0 ? (
          <Empty description="暂无套餐" />
        ) : (
          <Row gutter={[16, 16]}>
            {packages.map((pkg) => (
              <Col key={pkg.id} xs={12} sm={6}>
                <Card
                  hoverable
                  className="text-center border-primary-100"
                  styles={{ body: { padding: '16px' } }}
                >
                  <Text strong className="block text-sm mb-1">
                    {pkg.name}
                  </Text>
                  <Text className="text-xl font-bold text-primary-600 block mb-1">
                    {pkg.points}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    积分
                  </Text>
                  <br />
                  <Text className="text-sm font-medium">{pkg.priceDisplay}</Text>
                  <br />
                  <Button type="primary" size="small" className="mt-2" disabled>
                    暂未开放
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* ===== 积分流水 ===== */}
      <Card
        title={
          <span>
            <RiseOutlined className="mr-2" />
            积分流水
          </span>
        }
      >
        <Table
          dataSource={transactions}
          rowKey="id"
          loading={txLoading}
          pagination={{
            current: txPage,
            total: txTotal,
            pageSize: 10,
            onChange: setTxPage,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
          }}
          columns={[
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (v: string) => formatTime(v),
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 100,
              render: (t: PointsTransactionType) => {
                const cfg = typeLabelMap[t] ?? { label: t, color: 'default' };
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
              },
            },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 100,
              render: (v: number) => (
                <Text type={v >= 0 ? 'success' : 'danger'} strong>
                  {v >= 0 ? `+${v}` : v}
                </Text>
              ),
            },
            {
              title: '余额',
              dataIndex: 'balanceAfter',
              width: 100,
              render: (v: number) => <Text>{v}</Text>,
            },
            { title: '说明', dataIndex: 'description', ellipsis: true },
          ]}
          locale={{ emptyText: <Empty description="暂无积分流水" /> }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}
