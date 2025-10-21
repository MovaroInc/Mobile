import { api } from './api';

export const getBusinessById = async (businessId: number) => {
  console.log('businessId', businessId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/businesses/get-business-by-id/${businessId}`);
  console.log('res', res);
  return res.data;
};

export const getBusinessAdmin = async (businessId: number) => {
  console.log('businessId', businessId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/business/get-business-admin/${businessId}`);
  console.log('get admin response', res);
  return res.data;
};
