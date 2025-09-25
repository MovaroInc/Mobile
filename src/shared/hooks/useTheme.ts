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
      bg: isDark ? '#181818' : '#FFFFFF',
      card: isDark ? '#1f1e1e' : '#FFFFFF',
      text: isDark ? '#E5E7EB' : '#181818',
      muted: isDark ? '#94A3B8' : '#6B7280',
      border: isDark ? '#363636' : '#c7cbd4',
      supp: isDark ? '#FF6A00' : '#FF6A00',
      accent: isDark ? '#00a6f4' : '#005ad0',
      borderSecondary: isDark ? '#292929' : '#dcdfe6',
    }),
    [isDark],
  );

  const setThemePreference = useApp(s => s.setThemePreference);
  return { mode, isDark, colors, preference: pref, setThemePreference };
}
