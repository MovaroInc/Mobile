import React from 'react';
import SessionProvider from './src/providers/SessionProvider';
import RootNavigator from './src/navigation/RootNavigation';
// optional providers you use (Gesture/SafeArea/Query/Toast) can wrap here

export default function App() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
