import { api } from './api';

export const getDrivers = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/employees/get-employee-by-business-id/${businessId}`);
  return res.data;
};
