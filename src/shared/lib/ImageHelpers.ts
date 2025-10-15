import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { api } from './api';

export const pickImageFromGallery = async () => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 2500,
        maxHeight: 2500,
        includeBase64: false,
        selectionLimit: 1,
      },
      response => {
        if (response.didCancel) {
          resolve(null); // User cancelled
        } else if (response.errorCode) {
          reject(new Error(response.errorMessage || 'Image pick failed'));
        } else {
          const asset = response.assets?.[0];
          resolve(asset || null); // Return the image object or null
        }
      },
    );
  });
};

export const takePhotoWithCamera = async () => {
  return new Promise((resolve, reject) => {
    console.log('takePhotoWithCamera');
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 2500,
        maxHeight: 2500,
        includeBase64: false,
        saveToPhotos: true,
      },
      response => {
        if (response.didCancel) {
          resolve(null); // User cancelled
        } else if (response.errorCode) {
          reject(new Error(response.errorMessage || 'Camera launch failed'));
        } else {
          const asset = response.assets?.[0];
          resolve(asset || null); // Return the photo object or null
        }
      },
    );
  });
};

export const uploadImage = async payload => {
  console.log('payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/images/upload_product_image`, payload);
  console.log('uploadImage res', res.data);
  return res.data;
};

export const addStopPhoto = async payload => {
  console.log('addStopPhoto payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-photos/add-stop-photo`, payload);
  console.log('addStopPhoto res', res.data);
  return res.data;
};

export const grabDriverTimeEntries = async (
  driver_id: number,
  date: string,
) => {
  console.log('grabDriverTimeEntries driver_id', driver_id);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/get-driver-time-entries/${driver_id}/${date}`);
  console.log('grabDriverTimeEntries res', res.data);
  return res.data;
};

export const grabDriverLastEntryPriorToday = async (
  id: number,
  date: string,
) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/get-driver-last-entry-prior-today/${id}/${date}`);
  console.log('grabDriverLastEntryPriorToday res', res.data);
  return res.data;
};

export const createTimeEntry = async payload => {
  console.log('createTimeEntry payload', payload);
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/add-time-entry`, payload);
  console.log('createTimeEntry res', res.data);
  return res.data;
};

export const updateTimeEntry = async (id: number, payload: any) => {
  console.log('updateTimeEntry payload', payload);
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/update-time-entry/${id}`, payload);
  console.log('updateTimeEntry res', res.data);
  return res.data;
};
