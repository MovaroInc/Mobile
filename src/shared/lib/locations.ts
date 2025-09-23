// src/shared/lib/location.ts
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation, { GeoOptions } from '@react-native-community/geolocation';

type IOSAuth =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'disabled'
  | 'authorizedAlways'
  | 'authorizedWhenInUse';

/** Check if location is enabled; if not, request it. Opens Settings when user blocks. */
export async function ensureLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }
    // iOS: request "when in use" (if already granted, this resolves immediately)
    Geolocation.getCurrentPosition(
      position => {
        if (position.coords.latitude && position.coords.longitude) {
          return true;
        } else {
          return false;
        }
      },
      error => {
        console.log('❌ Location error:', error);
        return false;
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
    );
    return false;
  } catch {
    return false;
  }
}

export async function grabCurrentLocation(
  opts: GeoOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 1000,
  },
): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return { latitude: null, longitude: null };
      }
    }

    return await new Promise(resolve => {
      Geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos?.coords ?? {};
          resolve({
            latitude: typeof latitude === 'number' ? latitude : null,
            longitude: typeof longitude === 'number' ? longitude : null,
          });
        },
        err => {
          console.log('❌ Location error:', err);
          resolve({ latitude: null, longitude: null });
        },
        opts,
      );
    });
  } catch (e) {
    console.log('❌ grabCurrentLocation error:', e);
    return { latitude: null, longitude: null };
  }
}

/** Ensure permission, then try to read a location fix. Returns true iff a fix was obtained. */
