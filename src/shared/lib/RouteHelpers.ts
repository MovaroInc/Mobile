import { api } from './api';

export const createDraftRoute = async (payload: any) => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/add-route`, payload);
  console.log('res', res);
  return res.data;
};

export const getRoutesByBusinessId = async (
  businessId: number,
  selectedDate: string,
) => {
  console.log('getRoutesByBusinessId', businessId, selectedDate);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-by-business-id/${businessId}/${selectedDate}`);
  console.log('getRoutesByBusinessId res', res.data);
  return res.data;
};

export const getRouteById = async (routeId: number) => {
  console.log('getRouteById', routeId);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/routes/get-route-by-id/${routeId}`);
  console.log('getRouteById res', res.data);
  return res.data;
};
