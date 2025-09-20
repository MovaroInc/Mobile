import React from 'react';
import SessionProvider from './src/providers/SessionProvider';
import RootNavigator from './src/navigation/RootNavigation';
import AppProvider from './src/providers/AppProvider';
// optional providers you use (Gesture/SafeArea/Query/Toast) can wrap here

export default function App() {
  return (
    <SessionProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SessionProvider>
  );
}
