import { api } from './api';

export const createCustomer = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/customers/add-customer`, payload);
  return res.data;
};

export const createVendor = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/vendors/add-vendor`, payload);
  return res.data;
};

export const editCustomer = async (id: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/customers/update-customer/${id}`, payload);
  return res.data;
};

export const editVendor = async (id: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/vendors/update-vendor/${id}`, payload);
  return res.data;
};

export const deleteCustomer = async (id: number) => {
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/customers/delete-customer/${id}`);
  return res.data;
};

export const deleteVendor = async (id: number) => {
  const res = await api.delete<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/vendors/delete-vendor/${id}`);
  return res.data;
};

export const grabCustomers = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/customers/get-customer-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};

export const grabVendors = async (businessId: number) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/vendors/get-vendors-by-business-id/${businessId}`);
  console.log('res', res);
  return res.data;
};
