import React, { useEffect } from 'react';
import { StatusBar, View, Platform, Alert, NativeModules } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import SessionProvider from './src/providers/SessionProvider';
import AppProvider from './src/providers/AppProvider';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useTheme } from './src/shared/hooks/useTheme';
import RootNavigator from './src/navigation/RootNavigation';
// Removed redundant Geolocation import as it's handled in location.ts
// import Geolocation from '@react-native-community/geolocation';

import AsyncStorage from '@react-native-async-storage/async-storage';
import PushService, {
  requestNotificationPermission,
} from './src/shared/lib/PushNotificationService';
import { useSession } from './src/state/useSession';
import { storeNotificationToken } from './src/shared/lib/notifications';

// --- NEW IMPORTS ---
import {
  getOneFix,
  openAppSettings,
  LocationLevel,
} from './src/shared/lib/locations';
// -------------------

const { APNSTokenManager } = NativeModules;

const retrieveTokenFromNativeModule = async (profile: any) => {
  if (Platform.OS !== 'ios' || !APNSTokenManager) {
    return;
  }

  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const token = await APNSTokenManager.getDeviceToken();
      console.log('token', token);

      if (token) {
        await AsyncStorage.setItem('@apns_device_token', token);
        if (profile) {
          const payload = {
            apns_token: token,
            platform: 'ios',
            apns_env: 'production',
            device_model: Platform.select({
              ios: 'iPhone',
              android: 'Android',
            }),
            os_version: Platform.OS,
            profile_id: profile?.id,
          };
          console.log('payload', payload);
          await storeNotificationToken(payload);
        }
        return; // Exit loop on success
      }

      // Wait for 1, 2, 4, 8... seconds before retrying
      const delay = Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    } catch (e) {
      console.error(
        '[APNSTokenManager] ❌ Error retrieving token from native module:',
        e,
      );
      break;
    }
  }
};

/** * Handles checking and requesting location permission, and alerting the user
 * if permission is denied.
 */
const handleLocationPermission = async () => {
  try {
    const level: any = await getOneFix();

    if (!level?.ok) {
      // Permission was not granted after prompting, alert the user and offer to open settings
      Alert.alert(
        'Location Access Needed',
        'We need access to your location to calculate routes and check your proximity to the base. Please enable it in Settings.',
        [
          {
            text: 'Not now',
            style: 'cancel',
          },
          {
            text: 'Open Settings',
            onPress: openAppSettings,
          },
        ],
      );
    }
    // If authorized, the app can now reliably call getOneFix()
  } catch (e) {
    console.error('Error during location permission flow:', e);
  }
};

export default function App() {
  const { isDark, colors } = useTheme();
  const { profile } = useSession();

  // NOTE: Removed the old, unreliable checkLocation() function.
  // The location logic is now handled by handleLocationPermission().

  useEffect(() => {
    // 1. Handle Push Notification permissions and token retrieval
    requestNotificationPermission()
      .then(granted => {
        if (granted) {
          retrieveTokenFromNativeModule(profile || null);
        }
      })
      .catch(() => {
        console.log('error requesting notification permission');
      });

    // 2. Handle Location permissions
    void handleLocationPermission();

    // Note: Since you are using a custom native module, PushService.initialize() is
    // redundant for token fetching but might be needed for notification listeners.
    // If PushService only contains listeners, you might need to call it here:
    // PushService.initialize();

    // However, for this solution, we focus only on the token retrieval via the custom module.
  }, [profile]);

  /** ----- LOCATION (optional) ----- */

  return (
    <StripeProvider publishableKey="pk_test_51S5GXyGlDXxl46rgHIEDVlnpz0aRTlpm4wzfGtS1lLtAv6O75sx73RoFxMQgOuCnBDxHozrjkDD7LaSSqRmyfLCO00cZn3B8Bc">
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, backgroundColor: colors.brand.primary }}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.bg}
            translucent={false}
          />
          <SessionProvider>
            <AppProvider>
              <RootNavigator />
            </AppProvider>
          </SessionProvider>
        </View>
      </SafeAreaProvider>
    </StripeProvider>
  );
}
