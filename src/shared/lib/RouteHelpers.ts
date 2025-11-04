import { api } from './api';

export const createDraftRoute = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/add-route`, payload);
  return res.data;
};

export const updateDraftRoute = async (payload: any, routeId: number) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/update-route/${routeId}`, payload);
  return res.data;
};

export const getRoutesByBusinessId = async (
  businessId: number,
  selectedDate: string,
) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-todays-routes/${businessId}/${selectedDate}`);
  return res.data;
};

export const getDraftRoutesByBusinessId = async (
  businessId: number,
  selectedDate: string,
) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-todays-draft-routes/${businessId}/${selectedDate}`);
  return res.data;
};

export const getRouteById = async (routeId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-by-id/${routeId}`);
  return res.data;
};

export const publishRouteWithStops = async (routeId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/publish-route-with-stops/${routeId}`, payload);
  return res.data;
};

export const grabRouteProfileAndDate = async (
  profileId: number,
  date: string,
) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-profile-and-date/${profileId}/${date}`);
  return res.data;
};

export const grabRouteCount = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-count-for-business/${businessId}`);
  return res.data;
};

export const reassignDriver = async (routeId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/update-route/${routeId}`, payload);
  return res.data;
};

export const updateRouter = async (routeId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/update-route/${routeId}`, payload);
  return res.data;
};

export const grabRouteBreaks = async (routeId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/route-breaks/get-route-breaks-by-route-id/${routeId}`);
  return res.data;
};

export const newRouteBreak = async (payload: any) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/route-breaks/add-route-break`, payload);
  return res.data;
};

export const updateRouteBreak = async (routeBreakId: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/route-breaks/update-route-break/${routeBreakId}`, payload);
  return res.data;
};

export const deleteRoute = async (routeId: number) => {
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/delete-route/${routeId}`);
  return res.data;
};
