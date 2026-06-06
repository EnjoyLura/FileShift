import { useNavigate } from 'react-router-dom';
import { Badge } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';

interface PointsBadgeProps {
  /** 图标大小（px） */
  size?: number;
  /** 是否可点击跳转积分页 */
  clickable?: boolean;
}

/**
 * PointsBadge — 积分徽章组件
 *
 * 在顶部导航栏、侧边栏等位置显示当前积分余额。
 * 未登录时不显示。
 */
export default function PointsBadge({ size = 18, clickable = true }: PointsBadgeProps) {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuthStore();

  if (!isLoggedIn || !user) return null;

  const badge = (
    <Badge
      count={user.points}
      overflowCount={9999}
      showZero
      color="blue"
      size="small"
    >
      <GiftOutlined style={{ fontSize: size }} className="text-gray-500" />
    </Badge>
  );

  if (clickable) {
    return (
      <span onClick={() => navigate('/points')} className="cursor-pointer">
        {badge}
      </span>
    );
  }

  return badge;
}
