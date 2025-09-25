import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../shared/hooks/useTheme';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={['top', 'right', 'bottom', 'left']}
    >
      {children}
    </SafeAreaView>
  );
}
