// src/shared/lib/api.ts
import axios from 'axios';
import Config from 'react-native-config';

export const api = axios.create({
  baseURL: Config.API_BASE, // e.g. https://api.movaro.app
  timeout: 15000,
});

// Set/clear Bearer token (call this after /login or /signup when you add tokens)
export const setAuthToken = (token: string | null) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};
