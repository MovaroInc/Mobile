// src/navigation/RootNavigator.tsx
import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../shared/hooks/useTheme';
import { useSession } from '../state/useSession';
import AuthNavigation from './auth/AuthNavigation';
import AdminNavigation from './admin/AdminNavigation';
import UserTab from './users/tabs/UserTabNavigation';
import DriverNavigation from './driver/DriverNavigation';
import SubscriptionNavigation from './subscription/SubscriptionNavigation';

export default function RootNavigator() {
  const { isDark, colors } = useTheme();
  const { status, bootstrapped, profile, subscription } = useSession();

  const base = isDark ? DarkTheme : DefaultTheme;
  const appBg = colors.bg; // single source of truth

  const navTheme = useMemo(
    () => ({
      ...base, // keep fonts/animations/etc
      colors: {
        ...base.colors,
        background: appBg, // screen background
        card: appBg, // headers/tab surfaces
      },
    }),
    [isDark, appBg],
  );

  if (!bootstrapped || status === 'unknown') return null;

  return (
    <NavigationContainer theme={navTheme}>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: appBg }}
      >
        {status === 'signedOut' ? (
          <AuthNavigation />
        ) : subscription === null || subscription.status !== 'active' ? (
          <SubscriptionNavigation />
        ) : profile?.role === 'founder' ? (
          <AdminNavigation />
        ) : profile?.role === 'owner' ? (
          <UserTab />
        ) : (
          <DriverNavigation />
        )}
      </SafeAreaView>
    </NavigationContainer>
  );
}
