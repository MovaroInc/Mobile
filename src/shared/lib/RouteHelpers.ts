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

export const getRouteById = async (routeId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-by-id/${routeId}`);
  return res.data;
};
