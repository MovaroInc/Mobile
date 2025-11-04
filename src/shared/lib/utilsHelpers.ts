import { api } from './api';

export const SubmitSupportTicket = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/utils/create-support-ticket`, payload);
  return res.data;
};
