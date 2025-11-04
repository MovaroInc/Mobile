import { api } from './api';

export const createStop = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/add-stop`, payload);
  return res.data;
};

export const createStopsPayments = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-payments/add-stop-payment`, payload);
  return res.data;
};

export const createStopsRequirements = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-requirements/add-stop-requirement`, payload);
  return res.data;
};

export const createStopsPhotos = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-photos/add-stop-photo`, payload);
  return res.data;
};

export const getStopById = async stopId => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/get-stop-by-id/${stopId}`);
  return res.data;
};

export const updateStop = async (stopId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/update-stop/${stopId}`, payload);
  return res.data;
};

export const updateStopStatus = async (stopId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/update-stop/${stopId}`, payload);
  return res.data;
};

export const deleteStop = async (stopId: number) => {
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/delete-stop/${stopId}`);
  return res.data;
};

export const updateStopSequence = async (stopId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stops/update-stop/${stopId}`, payload);
  return res.data;
};

export const updateStopPayment = async (stopId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-payments/update-stop-payment/${stopId}`, payload);
  return res.data;
};
