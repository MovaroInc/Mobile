import { api } from './api';

export const createOptimizedRoute = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/optimization/optimize-with-google`, payload);
  console.log('createStop res', res.data);
  return res.data;
};
