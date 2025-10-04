import { api } from './api';

export const getSubscriptionByBusinessId = async (businessId: number) => {
  console.log('businessId', businessId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/subscriptions/get-subscriptions-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};
