import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  walletAddress?: string;
  githubId?: string;
  githubLogin?: string;
  walletRequired?: boolean;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  fetchUser: async () => {
    const { token } = get();
    if (!token) return;
    
    try {
      console.log('Fetching user with token:', token.substring(0, 20) + '...');
      const { data } = await api.get('/users/me');
      console.log('User data received:', data);
      set({ user: data });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // 如果token无效，清理状态
      set({ user: null, token: null });
      localStorage.removeItem('token');
    }
  },

  logout: () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_redirect');
      localStorage.removeItem('wagmi.store');
      localStorage.removeItem('wagmi.connected');
      localStorage.removeItem('wagmi.wallet');
      localStorage.removeItem('rk-recent');
      // Clear all wagmi/rainbowkit related keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('wagmi') || key.startsWith('rk-') || key.startsWith('rainbow')) {
          localStorage.removeItem(key);
        }
      });
      set({ user: null, token: null });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },
}));
