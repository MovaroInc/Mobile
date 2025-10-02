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
