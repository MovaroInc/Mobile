import { useMemo } from 'react';
import { useApp } from '../../state/useApp';

export function useTheme() {
  const pref = useApp(s => s.themePreference);
  const device = useApp(s => s.deviceScheme);
  const mode: 'light' | 'dark' = pref === 'system' ? device ?? 'light' : pref;
  const isDark = mode === 'dark';

  const colors = useMemo(
    () => ({
      brand: { primary: '#005ad0', secondary: '#F08000' },
      main: isDark ? '#0d0d0d' : '#FFFFFF',
      bg: isDark ? '#181818' : '#FFFFFF',
      card: isDark ? '#292727' : '#e5e5e5',
      text: isDark ? '#E5E7EB' : '#181818',
      textSecondary: isDark ? '#D9D9D9' : '#323232',
      textOpposite: isDark ? '#181818' : '#E5E7EB',
      muted: isDark ? '#94A3B8' : '#6B7280',
      border: isDark ? '#363636' : '#c7cbd4',
      supp: isDark ? '#FF6A00' : '#FF6A00',
      accent: isDark ? '#00a6f4' : '#005ad0',
      borderSecondary: isDark ? '#292929' : '#dcdfe6',
      cardSecondary: isDark ? '#424242' : '#CCCCCC',
      button: isDark ? '#3f3f3f' : '#c0c0c0',
      buttonMuted: isDark ? '#292929' : '#dcdfe6',
      lightaccent: isDark ? '#6bc5f0' : '#3679d2',
      icon: '#9CA3AF',
      active: isDark ? '#4884CF' : '#4884CF',
      inactive: isDark ? '#656D78' : '#9E9E9E',
    }),
    [isDark],
  );

  const setThemePreference = useApp(s => s.setThemePreference);
  return { mode, isDark, colors, preference: pref, setThemePreference };
}
