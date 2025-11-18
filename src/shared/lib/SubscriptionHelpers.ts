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

export const createDefaultSubscription = async (
  businessId: number,
  email: string,
  name: string,
) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    message: string | null;
  }>(`/stripe/billing/create-free-subscription/${businessId}`, {
    businessId,
    email,
    name,
  });
  return res.data;
};

export const getLast30DaysUsage = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    message: string | null;
  }>(`/subscriptions/get-stop-usage-last-30-days/${businessId}`);

  console.log('res', JSON.stringify(res.data, null, 2));
  return res.data;
};
