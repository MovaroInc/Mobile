// src/navigation/RootNavigator.tsx
import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack'; // or native-stack
import { useTheme } from '../shared/hooks/useTheme';
import { useSession } from '../state/useSession';
import AuthNavigation from './auth/AuthNavigation';
import AdminNavigation from './admin/AdminNavigation';
import UserNavigation from './users/UserNavigation';
import DriverNavigation from './driver/DriverNavigation';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { isDark, colors } = useTheme();
  const { status, bootstrapped, profile } = useSession();

  const navTheme = useMemo(
    () => ({
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.bg, // screen background
        card: colors.card, // headers, tab bar surface
        text: colors.text,
        border: colors.border,
        primary: colors.brand.primary,
      },
    }),
    [isDark, colors],
  );

  if (!bootstrapped || status === 'unknown') return null; // or a Splash

  return (
    <NavigationContainer theme={navTheme}>
      {status === 'signedOut' ? (
        <AuthNavigation />
      ) : profile?.role === 'ADMIN' ? (
        <AdminNavigation />
      ) : profile?.role === 'MANAGER' ? (
        <UserNavigation />
      ) : (
        <DriverNavigation />
      )}
    </NavigationContainer>
  );
}
