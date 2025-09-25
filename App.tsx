import React from 'react';
import { StatusBar } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import SessionProvider from './src/providers/SessionProvider';
import AppProvider from './src/providers/AppProvider';
import RootNavigator from './src/navigation/RootNavigation';
import { StripeProvider } from '@stripe/stripe-react-native';

export default function App() {
  return (
    <StripeProvider publishableKey="pk_test_51S5GXyGlDXxl46rgHIEDVlnpz0aRTlpm4wzfGtS1lLtAv6O75sx73RoFxMQgOuCnBDxHozrjkDD7LaSSqRmyfLCO00cZn3B8Bc">
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <StatusBar barStyle="light-content" />
        <SessionProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </StripeProvider>
  );
}
