import { api } from './api';

export const CreateInbox = async (payload: any) => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/create-inbox`, payload);
  console.log('res', res);
  return res.data;
};

export const GetInboxByBusinessId = async (businessId: number) => {
  console.log('businessId', businessId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/get-inbox-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};

export const emitInboxEvent = async (businessId: number) => {
  console.log('payload', businessId);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/emit-expired-invites/${businessId}`);
  console.log('res', res);
  return res.data;
};
