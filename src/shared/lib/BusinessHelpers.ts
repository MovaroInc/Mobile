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
