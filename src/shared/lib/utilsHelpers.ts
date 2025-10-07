import { api } from './api';

export const SubmitSupportTicket = async (payload: any) => {
  console.log('submitting support ticket', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/utils/create-support-ticket`, payload);
  console.log('res', res);
  return res.data;
};
