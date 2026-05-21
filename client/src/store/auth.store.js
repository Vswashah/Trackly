import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    set({ user: res.data.user });
    return res.data.user;
  },

  register: async (email, password, full_name) => {
    const res = await api.post('/auth/register', { email, password, full_name });
    localStorage.setItem('access_token', res.data.access_token);
    set({ user: res.data.user });
    return res.data.user;
  },

  logout: async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    set({ user: null });
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data, loading: false });
    } catch {
      localStorage.removeItem('access_token');
      set({ user: null, loading: false });
    }
  },
}));

export default useAuthStore;