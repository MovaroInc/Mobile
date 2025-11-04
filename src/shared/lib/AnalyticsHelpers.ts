import { api } from './api';

export const getBusinessAdmin = async (
  businessId: number,
  startDate: string | null,
  endDate: string,
) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/analytics/get-analytics/${businessId}`, {
    startDate,
    endDate,
  });
  return res.data;
};

export const getAnalyticsByDriverId = async (
  businessId: number,
  startDate: string | null,
  endDate: string,
) => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/analytics/get-analytics-by-driver/${businessId}`, {
    startDate,
    endDate,
  });
  return res.data;
};
