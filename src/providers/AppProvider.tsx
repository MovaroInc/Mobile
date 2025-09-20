// src/providers/AppProvider.tsx
import React, { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import tw from 'twrnc';
import { useApp } from '../state/useApp';

export default function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const osScheme = useColorScheme(); // 'light' | 'dark' | null
  const setDeviceScheme = useApp(s => s.setDeviceScheme);
  const pref = useApp(s => s.themePreference);

  // reflect OS scheme into store (runtime only)
  useEffect(() => {
    if (osScheme === 'light' || osScheme === 'dark') setDeviceScheme(osScheme);
  }, [osScheme, setDeviceScheme]);

  // keep twrnc in sync with effective theme
  useEffect(() => {
    const { themePreference, deviceScheme } = useApp.getState();
    const effective =
      themePreference === 'system' ? deviceScheme ?? 'light' : themePreference;
    tw.setColorScheme(effective);
  }, [pref, osScheme]);

  // handle live changes even if component tree doesn't rerender yet
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme === 'light' || colorScheme === 'dark') {
        setDeviceScheme(colorScheme);
        const effective =
          useApp.getState().themePreference === 'system'
            ? colorScheme
            : useApp.getState().themePreference;
        tw.setColorScheme(effective);
      }
    });
    return () => sub.remove();
  }, [setDeviceScheme]);

  return <>{children}</>;
}
