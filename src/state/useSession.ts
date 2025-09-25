import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { api } from '../shared/lib/api';

const kv = new MMKV({ id: 'movaro-session' });
const mmkvStorage = {
  getItem: (k: string) => kv.getString(k) ?? null,
  setItem: (k: string, v: string) => kv.set(k, v),
  removeItem: (k: string) => kv.delete(k),
};

export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn';

export type Profile = {
  id: number;
  user_id: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  business_id: number | null;
  employee_id: number | null;
  subscription_id: number | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
} | null;

export type Business = Record<string, any> | null;
export type Employee = Record<string, any> | null;
export type Subscription = Record<string, any> | null;

// Response shape from /users/me
type MeResponse = {
  success: boolean;
  data: {
    profile: Profile;
    business: Business;
    employee: Employee;
    subscription: Subscription;
  };
  message?: string | null;
};

type SessionState = {
  status: AuthStatus;
  bootstrapped: boolean;
  userId?: string;

  profile: Profile;
  business: Business;
  employee: Employee;
  subscription: Subscription;

  setSignedIn: (p: { userId?: string }) => void;
  setUserId: (p: { userId?: string }) => void;
  setEntities: (p: {
    profile?: Profile;
    business?: Business;
    employee?: Employee;
    subscription?: Subscription;
  }) => void;
  setSignedOut: () => void;
  setBootstrapped: (b: boolean) => void;
  hardReset: () => void;

  /** Fetches /users/me and updates entities (requires userId already set in the store). */
  refreshMe: () => Promise<void>;
};

const initial: Pick<SessionState, 'status' | 'bootstrapped'> = {
  status: 'unknown',
  bootstrapped: false,
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initial,
      userId: undefined,
      profile: null,
      business: null,
      employee: null,
      subscription: null,

      setSignedIn: ({ userId }) =>
        set(s => ({ ...s, status: 'signedIn', userId: userId ?? s.userId })),

      setUserId: ({ userId }) =>
        set(s => ({ ...s, userId: userId ?? s.userId })),

      setEntities: ({ profile, business, employee, subscription }) =>
        set(s => ({
          ...s,
          profile: profile !== undefined ? profile : s.profile,
          business: business !== undefined ? business : s.business,
          employee: employee !== undefined ? employee : s.employee,
          subscription:
            subscription !== undefined ? subscription : s.subscription,
        })),

      setSignedOut: () =>
        set(() => ({
          status: 'signedOut',
          userId: undefined,
          profile: null,
          business: null,
          employee: null,
          subscription: null,
          bootstrapped: true,
        })),

      setBootstrapped: b => set(s => ({ ...s, bootstrapped: b })),

      hardReset: () =>
        set(() => ({
          status: 'signedOut',
          userId: undefined,
          profile: null,
          business: null,
          employee: null,
          subscription: null,
          bootstrapped: true,
        })),

      // NEW
      refreshMe: async () => {
        const userId = get().userId;
        if (!userId) return;
        try {
          const res = await api.post('/users/me', { userId });
          const me = res.data as MeResponse;
          if (me?.success) {
            set(s => ({
              ...s,
              profile: me.data.profile ?? s.profile,
              business: me.data.business ?? s.business,
              employee: me.data.employee ?? s.employee,
              subscription: me.data.subscription ?? s.subscription,
            }));
          }
        } catch (e) {
          console.log('[useSession.refreshMe] error:', e);
        }
      },
    }),
    {
      name: 'movaro/session',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: s => ({
        status: s.status,
        bootstrapped: s.bootstrapped,
        userId: s.userId,
        profile: s.profile,
        business: s.business,
        employee: s.employee,
        subscription: s.subscription,
      }),
    },
  ),
);

// selectors
export const useAuthStatus = () => useSession(s => s.status);
export const useBootstrapped = () => useSession(s => s.bootstrapped);
export const useProfile = () => useSession(s => s.profile);
export const useBusiness = () => useSession(s => s.business);
export const useEmployee = () => useSession(s => s.employee);
export const useSubscription = () => useSession(s => s.subscription);
export const useUserId = () => useSession(s => s.userId);
