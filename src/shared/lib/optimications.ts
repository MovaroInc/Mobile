import { api } from './api';

export const createOptimizedRoute = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/optimization/optimize-with-google`, payload);
  return res.data;
};
