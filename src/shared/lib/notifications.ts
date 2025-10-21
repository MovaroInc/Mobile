import { api } from './api';

export const storeNotificationToken = async (payload: any) => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/store-token`, payload);
  console.log('notification res', res);
  return res.data;
};

export const updateNotification = async (id: number, payload: any) => {
  console.log('payload', payload);
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/update-token/${id}`, payload);
  console.log('notification res', res);
  return res.data;
};

export const sendNotification = async (payload: any) => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/notifications/send-notification`, payload);
  console.log('notification res', res);
  return res.data;
};
