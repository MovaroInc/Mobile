import React from 'react';
import { StatusBar } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import SessionProvider from './src/providers/SessionProvider';
import AppProvider from './src/providers/AppProvider';
import RootNavigator from './src/navigation/RootNavigation';

export default function App() {
  return (
    <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" />
      <SessionProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
