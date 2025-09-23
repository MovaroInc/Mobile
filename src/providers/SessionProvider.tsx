// src/providers/SessionProvider.tsx
import React, { useEffect } from 'react';
import { supabase } from '../shared/lib/supabase';
import {
  useSession,
  type Profile,
  type Business,
  type Employee,
  type Subscription,
} from '../state/useSession';
import { api } from '../shared/lib/api';

// Match your /users/me response
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

// Call your API passing userId directly
async function fetchMe(userId: string): Promise<MeResponse | null> {
  try {
    const res = await api.post('/users/me', { userId });
    // Axios: data is the JSON payload
    return res.data as MeResponse;
  } catch (e) {
    console.log('[SessionProvider] fetchMe error:', e);
    return null;
  }
}

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setSignedIn = useSession(s => s.setSignedIn);
  const setEntities = useSession(s => s.setEntities);
  const setSignedOut = useSession(s => s.setSignedOut);
  const setBootstrapped = useSession(s => s.setBootstrapped);
  const hardReset = useSession(s => s.hardReset);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Cold start: do we have a Supabase session?
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setSignedOut(); // status=signedOut
          setBootstrapped(true); // nav can render auth flow immediately
        }
        return;
      }

      // We have a session → minimally mark signed-in and capture userId
      const uid = session.user.id;
      if (!cancelled) setSignedIn({ userId: uid });

      // 2) Resolve app entities from your API (with userId)
      const me = await fetchMe(uid);
      if (!cancelled) {
        if (me?.success) {
          setEntities({
            profile: me.data.profile ?? null,
            business: me.data.business ?? null,
            employee: me.data.employee ?? null,
            subscription: me.data.subscription ?? null,
          });
        }
        setBootstrapped(true);
      }
    })();

    // 3) Live updates: login/logout/token refresh
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Signed out or no session -> clear everything
        if (!session || event === 'SIGNED_OUT') {
          hardReset(); // status=signedOut + entities cleared + bootstrapped=true
          return;
        }

        // Any event that implies we have/updated a session
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          const uid = session.user.id;
          setSignedIn({ userId: uid });

          const me = await fetchMe(uid);
          if (me?.success) {
            setEntities({
              profile: me.data.profile ?? null,
              business: me.data.business ?? null,
              employee: me.data.employee ?? null,
              subscription: me.data.subscription ?? null,
            });
          }

          setBootstrapped(true);
        }
      },
    );

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, [setSignedIn, setEntities, setSignedOut, setBootstrapped, hardReset]);

  return <>{children}</>;
}
