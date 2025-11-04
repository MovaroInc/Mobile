import { api } from './api';

export const CreateInbox = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/create-inbox`, payload);
  return res.data;
};

export const GetInboxByBusinessId = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/get-inbox-by-business-id/${businessId}`);
  return res.data;
};

export const emitInboxEvent = async (businessId: number) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/emit-expired-invites/${businessId}`);
  return res.data;
};

export const MarkInboxAsRead = async (inboxId: number, inboxUserId: number) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/inbox/mark-inbox-as-read/${inboxId}/${inboxUserId}`);
  return res.data;
};
