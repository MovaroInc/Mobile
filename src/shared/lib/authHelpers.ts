import { api } from './api';

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
  subsubscriptionId: number,
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
    customer_id,
    employee_id,
    subsubscriptionId,
    profilePicture,
    role,
    status,
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
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/customers/add-customer', {
    businessId,
    name,
    slug,
    phone,
    email,
    contactName,
    contactEmail,
    contactPhone,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
    country,
    latitude,
    longitude,
    location,
    location_type,
    reference_number,
    special_requirements,
    tags,
    settings,
  });
  return { success, data, error, message };
}

export async function updateProfileAndBusiness(
  profile: any,
  business: any,
  employee: any,
  customer: any,
): Promise<{ success: boolean; data: any; error: any; message: string }> {
  console.log('updating profile and business', profile, business, employee);
  const { success, data, error, message } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/users/update-profile', {
    business_id: business.id,
    employee_id: employee.id,
    id: profile.id,
  });
  if (!success) {
    return { success, data, error, message };
  }
  const {
    success: success2,
    data: data2,
    error: error2,
    message: message2,
  } = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>('/business/update-business', {
    customer_id: customer.id,
    id: business.id,
  });
  if (!success2) {
    return { success: success2, data: data2, error: error2, message: message2 };
  }
  return { success: success2, data: data2, error: error2, message: message2 };
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
