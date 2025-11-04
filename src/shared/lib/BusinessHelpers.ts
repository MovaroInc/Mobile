import { api } from './api';

export const getBusinessById = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/businesses/get-business-by-id/${businessId}`);
  return res.data;
};

export const getBusinessAdmin = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/business/get-business-admin/${businessId}`);
  return res.data;
};
