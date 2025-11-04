import { api } from './api';

export const getDrivers = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/employees/get-employee-by-business-id/${businessId}`);
  return res.data;
};

export const inviteDriver = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/add-invite`, payload);
  return res.data;
};

export const getInviteByBusinessId = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/get-invites-by-business-id/${businessId}`);
  return res.data;
};

export const getInviteByAccessCode = async (accessCode: string) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/get-invites-by-access-code/${accessCode}`);
  return res.data;
};

export const updateInviteWIthAccepted = async (inviteId: number, payload) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/update-invite-with-accepted/${inviteId}`, payload);
  return res.data;
};

export const deleteInvite = async (inviteId: number) => {
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/delete-invite/${inviteId}`);
  return res.data;
};
