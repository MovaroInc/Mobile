// src/state/useApp.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";

const mmkv = new MMKV({ id: "movaro-app" });
const storage = {
  getItem: (k: string) => mmkv.getString(k) ?? null,
  setItem: (k: string, v: string) => mmkv.set(k, v),
  removeItem: (k: string) => mmkv.delete(k),
};

export type ThemePreference = "system" | "light" | "dark";
export type ThemeMode = "light" | "dark";

type AppState = {
  // persisted user-facing app prefs
  themePreference: ThemePreference;    // persists across launches

  // runtime-only signals (don’t persist)
  deviceScheme?: ThemeMode;            // from useColorScheme / Appearance
  isOnline?: boolean;                  // optional: from NetInfo later

  // actions
  setThemePreference: (pref: ThemePreference) => void;
  setDeviceScheme: (mode: ThemeMode) => void;
  setIsOnline: (ok: boolean) => void;
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      themePreference: "system",
      setThemePreference: (pref) => set({ themePreference: pref }),
      setDeviceScheme: (mode) => set({ deviceScheme: mode }),
      setIsOnline: (ok) => set({ isOnline: ok }),
    }),
    {
      name: "movaro/app",
      storage: createJSONStorage(() => storage),
      // persist *only* true prefs; exclude runtime fields
      partialize: (s) => ({ themePreference: s.themePreference }),
    }
  )
);
