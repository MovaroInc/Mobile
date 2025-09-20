// src/ui/AppShell.tsx
import React from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme'; // returns { isDark, colors }

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>
    </SafeAreaProvider>
  );
}
