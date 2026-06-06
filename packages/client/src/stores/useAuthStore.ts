import { create } from 'zustand';

interface UserInfo {
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  avatar?: string | null;
  vipType?: string | null;
  points: number;
}

interface AuthState {
  /** 当前登录用户信息 */
  user: UserInfo | null;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 加载用户信息 */
  loadUser: () => Promise<void>;
  /** 设置用户信息 */
  setUser: (user: UserInfo) => void;
  /** 登录：存储 Token */
  login: (accessToken: string, refreshToken: string, user: UserInfo) => void;
  /** 登出：清除所有状态 */
  logout: () => void;
  /** 更新积分 */
  updatePoints: (points: number) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoggedIn: !!localStorage.getItem('accessToken'),

  loadUser: async () => {
    try {
      const { get: getApi } = await import('../services/api.js');
      const res = await getApi<UserInfo>('/v1/user/profile');
      if (res.code === 0 && res.data) {
        set({ user: res.data, isLoggedIn: true });
      }
    } catch {
      // 获取失败，清除登录态
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isLoggedIn: false });
    }
  },

  setUser: (user) => set({ user, isLoggedIn: true }),

  login: (accessToken, refreshToken, user) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isLoggedIn: false });
  },

  updatePoints: (points) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, points } });
    }
  },
}));
