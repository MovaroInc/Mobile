// src/shared/lib/location.ts
import { Platform, Linking, AppState, AppStateStatus } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  check,
  request,
  openSettings,
  RESULTS,
  PERMISSIONS,
  Permission,
  PermissionStatus,
} from 'react-native-permissions';

/** Normalized app-facing permission levels. */
export type LocationLevel =
  | { authorized: false; level: 'none' }
  | {
      authorized: true;
      level:
        | 'when_in_use' // iOS foreground
        | 'always' // iOS background
        | 'android_coarse' // Android coarse
        | 'android_fine' // Android precise foreground
        | 'android_fine_bg'; // Android precise + background
    };

const IOS_WIU: Permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
const IOS_ALWAYS: Permission = PERMISSIONS.IOS.LOCATION_ALWAYS;

const AND_COARSE: Permission = PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION;
const AND_FINE: Permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
// NOTE: AND_BG only available on Android 10+ and only if declared in AndroidManifest
const AND_BG: Permission = PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION;

/** Helper: is a status effectively granted for foreground reads? */
function isForegroundGranted(status: PermissionStatus) {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED; // iOS may return LIMITED
}

/** True if this level is equivalent to "Always"/background precision. */
export function isAlwaysLike(level: LocationLevel): boolean {
  return (
    (Platform.OS === 'ios' && level.authorized && level.level === 'always') ||
    (Platform.OS === 'android' &&
      level.authorized &&
      level.level === 'android_fine_bg')
  );
}

/** Read the current OS permission state and normalize to our LocationLevel. */
export async function getLocationLevel(): Promise<LocationLevel> {
  if (Platform.OS === 'ios') {
    const always = await check(IOS_ALWAYS);
    if (always === RESULTS.GRANTED)
      return { authorized: true, level: 'always' };

    const wiu = await check(IOS_WIU);
    if (isForegroundGranted(wiu))
      return { authorized: true, level: 'when_in_use' };

    return { authorized: false, level: 'none' };
  }

  // ANDROID
  const fine = await check(AND_FINE);
  if (fine === RESULTS.GRANTED) {
    try {
      const bg = await check(AND_BG);
      if (bg === RESULTS.GRANTED) {
        return { authorized: true, level: 'android_fine_bg' };
      }
    } catch {
      // ACCESS_BACKGROUND_LOCATION not declared or not needed — ignore
    }
    return { authorized: true, level: 'android_fine' };
  }

  const coarse = await check(AND_COARSE);
  if (coarse === RESULTS.GRANTED) {
    return { authorized: true, level: 'android_coarse' };
  }

  return { authorized: false, level: 'none' };
}

/** Ask for foreground permission once (When-In-Use / Fine). */
export async function requestForegroundOnce(): Promise<LocationLevel> {
  if (Platform.OS === 'ios') {
    const res = await request(IOS_WIU);
    if (isForegroundGranted(res))
      return { authorized: true, level: 'when_in_use' };
    return { authorized: false, level: 'none' };
  } else {
    // Prefer precise if available; Android will auto-downgrade on older OSes
    const res = await request(AND_FINE);
    if (res === RESULTS.GRANTED)
      return { authorized: true, level: 'android_fine' };

    // As a fallback, try coarse if fine was denied but coarse could be allowed
    const coarseRes = await request(AND_COARSE);
    if (coarseRes === RESULTS.GRANTED)
      return { authorized: true, level: 'android_coarse' };

    return { authorized: false, level: 'none' };
  }
}

/**
 * Try to upgrade to Always-like from foreground.
 * iOS: system may show a second prompt ONLY if Info.plist contains the Always key
 *      and When-In-Use is already granted.
 * Android: background permission typically requires going to Settings.
 */
export async function tryUpgradeToAlways(): Promise<LocationLevel> {
  if (Platform.OS === 'ios') {
    try {
      await request(IOS_ALWAYS);
    } catch {
      // Swallow — some iOS versions throw when not eligible to show the upgrade sheet
    }
    return getLocationLevel();
  } else {
    // Attempt background request if declared; many devices still require settings
    try {
      await request(AND_BG);
    } catch {
      // ignore
    }
    return getLocationLevel();
  }
}

/** Open the app Settings screen safely. */
export async function openAppSettings(): Promise<void> {
  try {
    await openSettings();
  } catch {
    await Linking.openURL('app-settings:').catch(() => {});
  }
}

/**
 * Utility: re-run a callback when returning to foreground (e.g., after Settings).
 * Usage:
 *   useEffect(() => onReturnFromSettings(() => recheck()), []);
 */
export function onReturnFromSettings(callback: () => void) {
  let prev: AppStateStatus = AppState.currentState;
  const sub = AppState.addEventListener('change', next => {
    if (prev.match(/inactive|background/) && next === 'active') {
      callback();
    }
    prev = next;
  });
  return () => sub.remove();
}

/** Convenience: ensure we have at least foreground permission, prompting once if needed. */
export async function ensureForegroundOrPrompt(): Promise<LocationLevel> {
  const lvl = await getLocationLevel();
  if (lvl.authorized) return lvl;

  const after = await requestForegroundOnce();
  return after;
}

/**
 * Optional: two-step iOS upgrade flow helper (explain → request Always → re-check).
 * On Android, this just attempts background once and re-checks.
 */
export async function ensureAlwaysFlow(): Promise<LocationLevel> {
  const current = await getLocationLevel();
  if (isAlwaysLike(current)) return current;

  // iOS requires WIU first
  if (
    Platform.OS === 'ios' &&
    (!current.authorized || current.level !== 'when_in_use')
  ) {
    await request(IOS_WIU);
  }
  const after = await tryUpgradeToAlways();
  return after;
}

/**
 * Optional: safe one-shot location read that never *triggers* a permission prompt.
 * Returns ok=false if permission isn’t already granted (so you can show your own modal).
 */
export async function getOneFix(
  opts: Geolocation.GeoOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 3000,
  },
): Promise<
  | {
      ok: true;
      coords: { latitude: number; longitude: number; accuracy?: number };
      timestamp: number;
    }
  | { ok: false; errorCode?: number; errorMessage?: string }
> {
  const lvl = await getLocationLevel();
  if (!lvl.authorized) {
    return { ok: false, errorCode: 1, errorMessage: 'Permission not granted' };
  }

  return await new Promise(resolve => {
    Geolocation.getCurrentPosition(
      p =>
        resolve({
          ok: true,
          coords: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
          },
          timestamp: p.timestamp,
        }),
      e => resolve({ ok: false, errorCode: e?.code, errorMessage: e?.message }),
      opts,
    );
  });
}

/**
 * Watch location convenience with typed unsubscribe.
 * NOTE: This expects permission to already be granted (does not prompt).
 */
export type Unsubscribe = () => void;
export function watchPosition(
  onPosition: (coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  }) => void,
  onError?: (error: { code?: number; message?: string }) => void,
  opts: Geolocation.GeoOptions = {
    enableHighAccuracy: true,
    distanceFilter: 5, // meters (iOS); Android uses time/accuracy heuristics
    timeout: 20000,
    maximumAge: 3000,
  },
): Unsubscribe {
  const id = Geolocation.watchPosition(
    p => {
      onPosition({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      });
    },
    e => onError?.({ code: e?.code, message: e?.message }),
    opts,
  );
  return () => Geolocation.clearWatch(id);
}

/**
 * Open system Location Services screen (best-effort).
 * Useful if GPS is disabled at the OS level even though app permission is granted.
 */
export async function openSystemLocationServices(): Promise<void> {
  if (Platform.OS === 'android') {
    // This URI opens location settings on most Android versions
    await Linking.openSettings().catch(() =>
      Linking.openURL('android.settings.LOCATION_SOURCE_SETTINGS').catch(
        () => {},
      ),
    );
  } else {
    // iOS has no direct Location Services deep link; app settings is the closest
    await openAppSettings();
  }
}

// src/shared/utils/distance.ts
export const MI_IN_METERS = 1609.344;

export type LatLng = { latitude: number; longitude: number };

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

/** Great-circle distance in meters (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // mean Earth radius in meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Check if current location is within 1 mile (~1609.344 m) of the route start.
 * Returns the raw distances so you can display them if needed.
 */
export function isWithinOneMile(
  current: LatLng,
  start: LatLng,
): { within: boolean; distanceMeters: number; distanceMiles: number } {
  if (
    !isFinite(current?.latitude) ||
    !isFinite(current?.longitude) ||
    !isFinite(start?.latitude) ||
    !isFinite(start?.longitude)
  ) {
    return { within: false, distanceMeters: NaN, distanceMiles: NaN };
    // (alternatively throw an Error if you prefer)
  }

  const distanceMeters = haversineMeters(current, start);
  const distanceMiles = distanceMeters / MI_IN_METERS;
  return { within: distanceMiles <= 1, distanceMeters, distanceMiles };
}
