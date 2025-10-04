import { api } from './api';

export const getDrivers = async (businessId: number) => {
  console.log('businessId', businessId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/employees/get-employee-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};

export const inviteDriver = async (payload: any) => {
  console.log('inviting driver', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/add-invite`, payload);
  console.log('res', res);
  return res.data;
};

export const getInviteByBusinessId = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/get-invites-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};

export const getInviteByAccessCode = async (accessCode: string) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/get-invites-by-access-code/${accessCode}`);
  console.log('res', res);
  return res.data;
};

export const updateInviteWIthAccepted = async (inviteId: number, payload) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/invites/update-invite-with-accepted/${inviteId}`, payload);
  console.log('res', res);
  return res.data;
};
