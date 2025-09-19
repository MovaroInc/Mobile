import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";

const kv = new MMKV({ id: "movaro-session" });
const mmkvStorage = {
  getItem: (k: string) => kv.getString(k) ?? null,
  setItem: (k: string, v: string) => kv.set(k, v),
  removeItem: (k: string) => kv.delete(k),
};

export type AuthStatus = "unknown" | "signedOut" | "signedIn";

export type Profile = {
  user_id: string,
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  username: string,
  test: boolean,
  role: string,
  status: string,
  lastLogin: Date,
  business_id: number,
  customer_id: number,
  latitude: number,
  longitude: number,
  location: string,
  point: any
}

type SessionState = {
  // snapshot
  status: AuthStatus;
  bootstrapped: boolean;         // we checked auth at least once
  userId?: string;
  profileId?: number;
  profile?: Profile;
  businessId?: string;

  // actions
  setSignedIn: (p: { userId?: string; profileId?: number; profile?: Profile, businessId?: string }) => void;
  setIds: (p: { profileId?: number; profile?: Profile, businessId?: string }) => void;
  setSignedOut: () => void;
  setBootstrapped: (b: boolean) => void;
  hardReset: () => void;
};

const initial: Pick<SessionState, "status" | "bootstrapped"> = {
  status: "unknown",
  bootstrapped: false,
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      ...initial,
      setSignedIn: ({ userId, profileId, profile, businessId }) =>
        set((s) => ({
          ...s,
          status: "signedIn",
          userId: userId ?? s.userId,
          profileId: profileId ?? s.profileId,
          profile: profile ?? s.profile,
          businessId: businessId ?? s.businessId,
        })),
      setIds: ({ profileId, profile, businessId }) =>
        set((s) => ({
          ...s,
          profileId: profileId ?? s.profileId,
          profile: profile ?? s.profile,
          businessId: businessId ?? s.businessId,
        })),
      setSignedOut: () =>
        set(() => ({
          status: "signedOut",
          userId: undefined,
          profileId: undefined,
          profile: undefined,
          businessId: undefined,
          bootstrapped: true,
        })),
      setBootstrapped: (b) => set((s) => ({ ...s, bootstrapped: b })),
      hardReset: () =>
        set(() => ({
          status: "signedOut",
          userId: undefined,
          profileId: undefined,
          profile: undefined,
          businessId: undefined,
          bootstrapped: true,
        })),
    }),
    {
      name: "movaro/session",
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist the essentials
      partialize: (s) => ({
        status: s.status,
        userId: s.userId,
        profileId: s.profileId,
        profile: s.profile,
        businessId: s.businessId,
        bootstrapped: s.bootstrapped,
      }),
    }
  )
);
