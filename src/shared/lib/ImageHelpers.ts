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
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/images/upload_product_image`, payload);
  return res.data;
};

export const addStopPhoto = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/stop-photos/add-stop-photo`, payload);
  return res.data;
};

export const grabDriverTimeEntries = async (
  driver_id: number,
  date: string,
) => {
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/get-driver-time-entries/${driver_id}/${date}`);
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
  return res.data;
};

export const createTimeEntry = async payload => {
  const res = await api.post<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/add-time-entry`, payload);
  return res.data;
};

export const updateTimeEntry = async (id: number, payload: any) => {
  const res = await api.put<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/drivers/update-time-entry/${id}`, payload);
  return res.data;
};
