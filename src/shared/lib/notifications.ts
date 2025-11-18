import { api } from './api';

export const storeNotificationToken = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/store-token`, payload);
  console.log('res', JSON.stringify(res.data, null, 2));
  return res.data;
};

export const updateNotification = async (id: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/update-token/${id}`, payload);
  return res.data;
};

export const sendNotification = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/send-notification`, payload);
  return res.data;
};
