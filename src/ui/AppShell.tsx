import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../shared/hooks/useTheme';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme(); // expects colors.bg
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, backgroundColor: 'white' }}>{children}</View>
    </SafeAreaView>
  );
}
