import { api } from './api';

export const grabCustomers = async (businessId: number) => {
  const { success, data, error, message } = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/customers/get-customer-by-business-id/${businessId}`);
  return { success, data, error, message };
};

export const grabVendors = async (businessId: number) => {
  const { success, data, error, message } = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/vendors/get-vendor-by-business-id/${businessId}`);

  return { success, data, error, message };
};
