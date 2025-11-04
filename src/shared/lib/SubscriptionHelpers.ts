import { api } from './api';

export const getSubscriptionByBusinessId = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/subscriptions/get-subscriptions-by-business-id/${businessId}`);
  return res.data;
};
