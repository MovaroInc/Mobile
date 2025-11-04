import { useSession } from '../../state/useSession';
import { api } from './api';
import { supabase } from './supabase';

export async function createUserAccount(
  email: string,
  password: string,
  username: string,
  firstName: string,
  lastName: string,
  phone: string,
  latitude: number,
  longitude: number,
  business_id: number,
  customer_id: number,
  employee_id: number,
  subscription_id: number,
  profilePicture: string,
  role: string,
  status: string,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/users/signup', {
    email,
    password,
    username,
    firstName,
    lastName,
    phone,
    latitude,
    longitude,
    business_id,
    employee_id,
    subscription_id,
    profilePicture,
    role,
    status,
    update_at: new Date().toISOString(),
  });
  return { success, data, error, message };
}

export async function createBusinessAccount(
  name: string,
  industry: string,
  phone: string,
  email: string,
  website: string,
  address1: string,
  address2: string,
  city: string,
  statue: string,
  zip: string,
  country: string,
  latitude: number,
  longitude: number,
  customerId: number,
  referenceNumber: number,
  stripeCustomerId: string,
  exempt: boolean,
  test: boolean,
  status: string,
  settings: any,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/business/add-business', {
    name,
    industry,
    phone,
    email,
    website,
    addressLine1: address1,
    addressLine2: address2,
    city,
    state: statue,
    zip: zip,
    country: country,
    latitude,
    longitude,
    customerId: customerId,
    referenceNumber: referenceNumber,
    stripeCustomerId: stripeCustomerId,
    exempt,
    test,
    status,
    settings,
  });
  return { success, data, error, message };
}

export async function createEmployeeAccount(
  businessId: number,
  profileId: number,
  status: string,
  employment: string,
  jobTitle: string,
  referenceNumber: number | null,
  mangerProfile: number | null,
  hiredAt: string,
  terminatedAt: string | null,
  isDriver: boolean,
  licenseNumber: string | null,
  licenseState: string | null,
  licenseClass: string | null,
  licenseExpired: string | null,
  phone: string,
  workEmail: string,
  notes: string | null,
  tags: string | null,
  settings: any,
  availability: string,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/employees/add-employee', {
    businessId,
    profileId,
    status,
    employment,
    jobTitle,
    referenceNumber,
    mangerProfile,
    hiredAt,
    terminatedAt,
    isDriver,
    licenseNumber,
    licenseState,
    licenseClass,
    licenseExpired,
    phone,
    workEmail,
    notes,
    tags,
    settings,
    availability,
  });
  return { success, data, error, message };
}

export async function createCustomerAccount(
  businessId: number,
  slug: string | null,
  name: string,
  phone: string,
  email: string,
  contactName: string,
  contactEmail: string,
  contactPhone: string,
  addressLine1: string,
  addressLine2: string,
  city: string,
  state: string,
  zip: string,
  country: string,
  latitude: number,
  longitude: number,
  location: string | null,
  location_type: string,
  reference_number: number,
  special_requirements: string | null,
  tags: string | null,
  settings: any,
  defaultCustomer: boolean,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/customers/add-customer', {
    business_id: businessId,
    name,
    slug,
    phone,
    email,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    address_line1: addressLine1,
    address_line2: addressLine2,
    city,
    region: state,
    postal_code: zip,
    country_code: country,
    latitude,
    longitude,
    location,
    reference_number,
    special_requirements,
    tags,
    settings,
    default: defaultCustomer,
  });
  return { success, data, error, message };
}

export async function updateProfileAndBusiness(
  profile: any,
  business: any,
  employee: any,
  customer: any,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const resp = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/users/update-profile/${profile.id}`, {
    business_id: business.id,
    employee_id: employee.id,
  });
  if (!resp.data.success) {
    return {
      success: false,
      data: null,
      error: resp.data.error,
      message: resp.data.message,
    };
  }

  const resp2 = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/business/update-business/${business.id}`, {
    customer_id: customer.id,
  });
  if (!resp2.data.success) {
    return {
      success: false,
      data: null,
      error: resp2.data.error,
      message: resp2.data.message,
    };
  }
  return { success: true, data: resp2.data.data, error: null, message: null };
}

const attemptLogin = async (username: string, password: string) => {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/users/login', { username, password });

  return { success, data, error, message };
};

export const updateProfileWithEmployeeId = async (
  business_id: number,
  employee_id: number,
  id: number,
) => {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/users/update-profile/${id}`, {
    business_id,
    employee_id,
  });
  return { success, data, error, message };
};
