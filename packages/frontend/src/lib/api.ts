import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 只在当前不是登录页时才清理并跳转
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        localStorage.removeItem('token');
        // 使用 window.location.replace 避免历史记录堆叠
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  },
);

export default api;
