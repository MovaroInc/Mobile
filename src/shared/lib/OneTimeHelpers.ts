import { api } from './api';

export const createOneTime = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/one-time/add-one-time`, payload);
  return res.data;
};
