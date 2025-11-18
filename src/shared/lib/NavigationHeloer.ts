import { api } from './api';

export const getRouteDirections = async (payload: any) => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/navigation/get-route-details`, payload);
  console.log('res', res);
  return res.data;
};
