import { api } from './api';

export const createStop = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/add-stop`, payload);
  console.log('createStop res', res.data);
  return res.data;
};

export const createStopsPayments = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-payments/add-stop-payment`, payload);
  console.log('createStopsPayments res', res.data);
  return res.data;
};

export const createStopsRequirements = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-requirements/add-stop-requirement`, payload);
  console.log('createStopsRequirements res', res.data);
  return res.data;
};

export const createStopsPhotos = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-photos/add-stop-photo`, payload);
  return res.data;
};

export const updateStop = async (stopId: number, payload: any) => {
  console.log('updateStop', stopId, payload);
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/update-stop/${stopId}`, payload);
  console.log('updateStop res', res.data);
  return res.data;
};

export const updateStopStatus = async (stopId: number, payload: any) => {
  console.log('updateStopStatus', stopId, payload);
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/update-stop/${stopId}`, payload);
  console.log('updateStop res', res.data);
  return res.data;
};

export const deleteStop = async (stopId: number) => {
  console.log('deleteStop', stopId);
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/delete-stop/${stopId}`);
  console.log('deleteStop res', res.data);
  return res.data;
};
