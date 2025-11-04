// App.tsx - Fixed Push Notifications (Custom Native Module Integration)
import React, { useEffect } from 'react';
import { StatusBar, View, Platform, Alert, NativeModules } from 'react-native'; // <-- NativeModules added
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import SessionProvider from './src/providers/SessionProvider';
import AppProvider from './src/providers/AppProvider';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useTheme } from './src/shared/hooks/useTheme';
import RootNavigator from './src/navigation/RootNavigation';
import Geolocation from '@react-native-community/geolocation';

import AsyncStorage from '@react-native-async-storage/async-storage';
// We still import the PushService, but its token retrieval/logging logic is now done here
import PushService, {
  requestNotificationPermission,
} from './src/shared/lib/PushNotificationService';
import { useSession } from './src/state/useSession';
import { storeNotificationToken } from './src/shared/lib/notifications';

const { APNSTokenManager } = NativeModules;

const retrieveTokenFromNativeModule = async (profile: any) => {
  if (Platform.OS !== 'ios' || !APNSTokenManager) {
    return;
  }

  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const token = await APNSTokenManager.getDeviceToken();

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

export default function App() {
  const { isDark, colors } = useTheme();
  const { profile } = useSession();
  const checkLocation = () => {
    const geo_success = (position: any) => {};
    const geo_error = (error: any) => {
      console.log('geo_error', error);
    };
    Geolocation.getCurrentPosition(geo_success, geo_error, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 1000,
    });
  };

  useEffect(() => {
    // 1. Request permissions (which triggers native registration via AppDelegate)
    requestNotificationPermission()
      .then(granted => {
        // 2. Start polling for the token stored by the native module
        if (granted) {
          retrieveTokenFromNativeModule(profile || null);
        }
      })
      .catch(() => {
        console.log('error requesting notification permission');
      });

    checkLocation();

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
