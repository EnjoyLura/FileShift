import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Avatar,
  Descriptions,
  Button,
  Input,
  Table,
  Tag,
  Tabs,
  Card,
  Spin,
  Empty,
  message,
  Modal,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  CrownOutlined,
  ShareAltOutlined,
  CopyOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { TaskStatus } from '@fileshift/shared';
import type { PaginatedResponse, PointsPackage } from '@fileshift/shared';
import { get, put } from '@/services/api';
import api from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';

const { Title, Text } = Typography;

// ========== 任务状态配置 ==========

const taskStatusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  [TaskStatus.PENDING]: { color: 'default', icon: <ClockCircleOutlined />, label: '排队中' },
  [TaskStatus.PROCESSING]: { color: 'processing', icon: <SyncOutlined spin />, label: '处理中' },
  [TaskStatus.COMPLETED]: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  [TaskStatus.FAILED]: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
};

// ========== 时间格式化 ==========

async function downloadFile(fileId: string, filename: string) {
  try {
    const res = await api.get(`/v1/files/${fileId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('开始下载');
  } catch {
    message.error('下载失败');
  }
}

// ========== 时间格式化 ==========

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ========== ProfilePage ==========

export default function ProfilePage() {
  const { user, setUser, logout } = useAuthStore();

  // 当前选中的 Tab
  const [activeTab, setActiveTab] = useState('account');

  // 昵称编辑
  const [editNicknameOpen, setEditNicknameOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  // ========== 使用记录 ==========

  const [taskList, setTaskList] = useState<
    Array<{
      id: string;
      status: TaskStatus;
      toolId: string;
      toolName: string;
      inputFileName: string;
      outputFile: { id: string; originalName: string } | null;
      pointsConsumed: number;
      createdAt: string;
    }>
  >([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [taskTotal, setTaskTotal] = useState(0);

  // ========== VIP ==========

  const [vipPackages, setVipPackages] = useState<PointsPackage[]>([]);
  const [vipLoading, setVipLoading] = useState(false);

  // ========== 邀请 ==========

  const [inviteInfo, setInviteInfo] = useState<{
    inviteCode: string;
    inviteCount: number;
    totalReward: number;
  } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // ========== 加载任务列表 ==========

  const loadTaskList = useCallback(async (page: number) => {
    setTaskLoading(true);
    try {
      const res = await get<
        PaginatedResponse<{
          id: string;
          status: TaskStatus;
          toolId: string;
          tool: { name: string };
          inputFile: { originalName: string };
          outputFile: { id: string; originalName: string } | null;
          pointsConsumed: number;
          createdAt: string;
        }>
      >('/v1/tasks', { page, pageSize: 10 });
      if (res.code === 0 && res.data) {
        setTaskList(
          res.data.list.map((t) => ({
            id: t.id,
            status: t.status,
            toolId: t.toolId,
            toolName: t.tool?.name ?? t.toolId,
            inputFileName: t.inputFile?.originalName ?? '-',
            outputFile: t.outputFile,
            pointsConsumed: t.pointsConsumed,
            createdAt: t.createdAt,
          }))
        );
        setTaskTotal(res.data.total);
      }
    } catch {
      /* ignore */
    } finally {
      setTaskLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadTaskList(taskPage);
  }, [activeTab, taskPage, loadTaskList]);

  // ========== 加载 VIP 套餐 ==========

  useEffect(() => {
    if (activeTab !== 'vip') return;
    setVipLoading(true);
    get<PointsPackage[]>('/v1/points/vip-packages')
      .then((res) => {
        if (res.code === 0 && res.data) setVipPackages(res.data);
      })
      .catch(() => {})
      .finally(() => setVipLoading(false));
  }, [activeTab]);

  // ========== 加载邀请信息 ==========

  useEffect(() => {
    if (activeTab !== 'invite') return;
    setInviteLoading(true);
    get<{ inviteCode: string; inviteCount: number; totalReward: number }>('/v1/points/invite')
      .then((res) => {
        if (res.code === 0 && res.data) setInviteInfo(res.data);
      })
      .catch(() => {})
      .finally(() => setInviteLoading(false));
  }, [activeTab]);

  // ========== 修改昵称 ==========

  const handleSaveNickname = useCallback(async () => {
    if (!nicknameInput.trim() || nicknameInput.trim().length < 2) {
      message.warning('昵称至少2个字符');
      return;
    }
    setNicknameSaving(true);
    try {
      const res = await put<{ nickname: string }>('/v1/user/profile', {
        nickname: nicknameInput.trim(),
      });
      if (res.code === 0) {
        if (user) setUser({ ...user, nickname: nicknameInput.trim() });
        message.success('昵称修改成功');
        setEditNicknameOpen(false);
      }
    } catch {
      message.error('修改失败');
    } finally {
      setNicknameSaving(false);
    }
  }, [nicknameInput, user, setUser]);

  // ========== 复制邀请码 ==========

  const handleCopyInvite = useCallback(() => {
    if (!inviteInfo?.inviteCode) return;
    navigator.clipboard.writeText(inviteInfo.inviteCode).then(
      () => message.success('邀请码已复制'),
      () => message.warning('复制失败，请手动复制')
    );
  }, [inviteInfo]);

  // ========== Tab 配置 ==========

  const tabItems = [
    {
      key: 'account',
      label: (
        <span>
          <UserOutlined className="mr-1" />
          账户信息
        </span>
      ),
      children: (
        <Card>
          {/* 头像 + 昵称 */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar size={64} icon={<UserOutlined />} className="bg-primary-500" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Text strong className="text-lg">
                  {user?.nickname || '用户'}
                </Text>
                {user?.vipType && (
                  <Tag color="gold" icon={<CrownOutlined />}>
                    {user.vipType}
                  </Tag>
                )}
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setNicknameInput(user?.nickname || '');
                    setEditNicknameOpen(true);
                  }}
                />
              </div>
              <Text type="secondary" className="text-sm">
                ID: {user?.id?.slice(0, 12)}...
              </Text>
            </div>
          </div>

          <Descriptions column={1} size="small" className="mb-4">
            <Descriptions.Item
              label={
                <>
                  <MailOutlined className="mr-1" />
                  邮箱
                </>
              }
            >
              {user?.email ? (
                <span>
                  {user.email}{' '}
                  <Tag color="green" className="ml-1">
                    已绑定
                  </Tag>
                </span>
              ) : (
                <Text type="secondary">未绑定</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <>
                  <PhoneOutlined className="mr-1" />
                  手机号
                </>
              }
            >
              {user?.phone ? (
                <span>
                  {user.phone}{' '}
                  <Tag color="green" className="ml-1">
                    已绑定
                  </Tag>
                </span>
              ) : (
                <Text type="secondary">未绑定</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <>
                  <GiftOutlined className="mr-1" />
                  积分
                </>
              }
            >
              <Text strong className="text-primary-600">
                {user?.points ?? 0}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <>
                  <CrownOutlined className="mr-1" />
                  VIP
                </>
              }
            >
              {user?.vipType ? (
                <Tag color="gold">{user.vipType}</Tag>
              ) : (
                <Text type="secondary">普通用户</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Button danger onClick={logout}>
            退出登录
          </Button>
        </Card>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <SyncOutlined className="mr-1" />
          使用记录
        </span>
      ),
      children: (
        <Card>
          <Table
            dataSource={taskList}
            rowKey="id"
            loading={taskLoading}
            pagination={{
              current: taskPage,
              total: taskTotal,
              pageSize: 10,
              onChange: setTaskPage,
              showSizeChanger: false,
              showTotal: (t) => `共 ${t} 条`,
            }}
            columns={[
              {
                title: '时间',
                dataIndex: 'createdAt',
                width: 160,
                render: (v: string) => formatTime(v),
              },
              { title: '工具', dataIndex: 'toolName', ellipsis: true },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (s: TaskStatus) => {
                  const cfg = taskStatusConfig[s] ?? taskStatusConfig[TaskStatus.PENDING];
                  return (
                    <Tag color={cfg.color} icon={cfg.icon}>
                      {cfg.label}
                    </Tag>
                  );
                },
              },
              {
                title: '消费',
                dataIndex: 'pointsConsumed',
                width: 80,
                render: (v: number) => `${v} 积分`,
              },
              {
                title: '操作',
                key: 'action',
                width: 100,
                render: (_: unknown, record: (typeof taskList)[0]) => {
                  if (record.status === TaskStatus.COMPLETED && record.outputFile) {
                    return (
                      <Button
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() =>
                          downloadFile(record.outputFile!.id, record.outputFile!.originalName)
                        }
                      >
                        下载
                      </Button>
                    );
                  }
                  return <Text type="secondary">-</Text>;
                },
              },
            ]}
            locale={{ emptyText: <Empty description="暂无使用记录" /> }}
            scroll={{ x: 600 }}
          />
        </Card>
      ),
    },
    {
      key: 'vip',
      label: (
        <span>
          <CrownOutlined className="mr-1" />
          VIP
        </span>
      ),
      children: (
        <Card>
          {user?.vipType && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Text strong className="text-yellow-700">
                当前 VIP：{user.vipType}
              </Text>
            </div>
          )}
          {vipLoading ? (
            <Spin />
          ) : vipPackages.length === 0 ? (
            <Empty description="暂无VIP套餐" />
          ) : (
            <Row gutter={[16, 16]}>
              {vipPackages.map((pkg) => (
                <Col key={pkg.id} xs={24} sm={12} md={8}>
                  <Card hoverable className="text-center border-primary-100">
                    <CrownOutlined className="text-3xl text-yellow-500 mb-2" />
                    <Title level={5}>{pkg.name}</Title>
                    <Text className="text-2xl font-bold text-primary-600 block mb-1">
                      {pkg.priceDisplay}
                    </Text>
                    <Text type="secondary" className="text-sm">
                      {pkg.description}
                    </Text>
                    <br />
                    <Button type="primary" className="mt-3" disabled>
                      暂未开放
                    </Button>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      ),
    },
    {
      key: 'invite',
      label: (
        <span>
          <ShareAltOutlined className="mr-1" />
          邀请好友
        </span>
      ),
      children: (
        <Card>
          {inviteLoading ? (
            <Spin />
          ) : inviteInfo ? (
            <>
              <Row gutter={[24, 16]} className="mb-6">
                <Col xs={12} sm={8}>
                  <Statistic title="已邀请" value={inviteInfo.inviteCount} suffix="人" />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title="累计奖励" value={inviteInfo.totalReward} suffix="积分" />
                </Col>
              </Row>
              <div className="p-4 bg-gray-50 rounded-lg">
                <Text strong>我的邀请码</Text>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    value={inviteInfo.inviteCode}
                    readOnly
                    className="text-lg font-mono text-center !w-48"
                  />
                  <Button icon={<CopyOutlined />} onClick={handleCopyInvite}>
                    复制
                  </Button>
                </div>
                <Text type="secondary" className="text-xs mt-2 block">
                  好友注册时输入邀请码，双方各得 20 积分
                </Text>
              </div>
            </>
          ) : (
            <Empty description="加载失败" />
          )}
        </Card>
      ),
    },
  ];

  // ========== 渲染 ==========

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <Title level={4} className="!mb-4">
        个人中心
      </Title>

      {/* 移动端：横向滚动 Tab */}
      <div className="md:hidden mb-4">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
          tabBarGutter={12}
        />
      </div>

      {/* PC 端：侧边栏 + 内容 */}
      <div className="hidden md:flex gap-6">
        {/* 左侧菜单 */}
        <div className="w-44 shrink-0">
          <div className="space-y-1">
            {[
              { key: 'account', icon: <UserOutlined />, label: '账户信息' },
              { key: 'history', icon: <SyncOutlined />, label: '使用记录' },
              { key: 'vip', icon: <CrownOutlined />, label: 'VIP 会员' },
              { key: 'invite', icon: <ShareAltOutlined />, label: '邀请好友' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === item.key
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 min-w-0">{tabItems.find((t) => t.key === activeTab)?.children}</div>
      </div>

      {/* 昵称编辑弹窗 */}
      <Modal
        title="修改昵称"
        open={editNicknameOpen}
        onOk={handleSaveNickname}
        onCancel={() => setEditNicknameOpen(false)}
        confirmLoading={nicknameSaving}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={nicknameInput}
          onChange={(e) => setNicknameInput(e.target.value)}
          placeholder="请输入新昵称（2-20个字符）"
          maxLength={20}
          className="mt-2"
        />
      </Modal>
    </div>
  );
}
