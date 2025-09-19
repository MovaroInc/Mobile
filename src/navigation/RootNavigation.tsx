// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useSession } from '../state/useSession';
import { Profile } from '../state/useSession';
import AuthNavigation from './auth/AuthNavigation';
import AdminNavigation from './admin/AdminNavigation';
import UserNavigation from './users/UserNavigation';
import DriverNavigation from './driver/DriverNavigation';

function Splash() {
  return null; // or your loader component
}

export default function RootNavigator() {
  const status = useSession(s => s.status);
  const bootstrapped = useSession(s => s.bootstrapped);
  const profileId = useSession(s => s.profileId);
  const businessId = useSession(s => s.businessId);
  const profile = useSession(s => s.Profile);

  if (!bootstrapped || status === 'unknown') return <Splash />;

  return (
    <NavigationContainer theme={DefaultTheme}>
      {status === 'signedOut' ? (
        <AuthNavigation />
      ) : profile.role === 'ADMIN' ? (
        <AdminNavigation />
      ) : profile.role === 'MANAGER' ? (
        <UserNavigation />
      ) : (
        <DriverNavigation />
      )}
    </NavigationContainer>
  );
}
