// App.tsx (REPLACE FILE)
import React from 'react';
import { StatusBar, View } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import SessionProvider from './src/providers/SessionProvider';
import AppProvider from './src/providers/AppProvider';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useTheme } from './src/shared/hooks/useTheme';
import RootNavigator from './src/navigation/RootNavigation';

export default function App() {
  const { isDark, colors } = useTheme(); // colors.main is the background you want

  return (
    <StripeProvider publishableKey="pk_test_51S5GXyGlDXxl46rgHIEDVlnpz0aRTlpm4wzfGtS1lLtAv6O75sx73RoFxMQgOuCnBDxHozrjkDD7LaSSqRmyfLCO00cZn3B8Bc">
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {/* OUTERMOST PAINT – ensures status bar/top & bottom safe areas match */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.brand.primary /* or '#0B0C10' */,
          }}
        >
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.bg} // Android only; iOS ignores
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
