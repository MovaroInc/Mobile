import { api } from './api';

export const getDrivers = async (payload: any) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/store-token`, payload);
  return res.data;
};
