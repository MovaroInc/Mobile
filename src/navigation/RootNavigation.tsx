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
import SubscriptionNavigation from './subscription/SubscriptionNavigation';
import { linking } from '../shared/lib/linking';
import DriverTabs from './driver/tabs/DriverTabs';

export default function RootNavigator() {
  const { isDark, colors } = useTheme();
  const { status, bootstrapped, profile, subscription } = useSession();

  const base = isDark ? DarkTheme : DefaultTheme;
  const appBg = colors.bg;

  const navTheme = useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        background: appBg,
        card: appBg,
      },
    }),
    [isDark, appBg],
  );

  if (!bootstrapped || status === 'unknown') return null;

  const hasValidSubscription =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing');

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: appBg }}
      >
        {status === 'signedOut' ? (
          <AuthNavigation />
        ) : !hasValidSubscription ? (
          <SubscriptionNavigation />
        ) : profile?.role === 'founder' ? (
          <AdminNavigation />
        ) : profile?.role === 'owner' ? (
          <UserTab />
        ) : (
          <DriverTabs />
        )}
      </SafeAreaView>
    </NavigationContainer>
  );
}
