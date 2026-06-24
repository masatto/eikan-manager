import axios from 'axios';
import { Player, AuthUser, AppConfig } from '../types/Player';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const getMe = () => api.get<AuthUser>('/auth/me').then(r => r.data);

export const getPlayers = () => api.get<Player[]>('/players').then(r => r.data);

export const createPlayer = (p: Player) =>
  api.post<Player>('/players', p).then(r => r.data);

export const updatePlayer = (p: Player) =>
  api.put<Player>(`/players/${p.id}`, p).then(r => r.data);

export const deletePlayer = (id: string) =>
  api.delete(`/players/${id}`);

export const getConfig = () =>
  api.get<AppConfig>('/config').then(r => r.data);

export const getWeights = () =>
  api.get<Record<string, Record<string, number>>>('/config/weights').then(r => r.data);

export const saveWeights = (weights: Record<string, Record<string, number>>) =>
  api.put('/config/weights', weights);

export const getRoles = () =>
  api.get<Record<string, { defense: number; batting: number }>>('/config/roles').then(r => r.data);

export const saveRoles = (roles: Record<string, { defense: number; batting: number }>) =>
  api.put('/config/roles', roles);

export const loginWithGoogle = () => {
  window.location.href = '/oauth2/authorization/google';
};

export const logout = () => {
  window.location.href = '/logout';
};
