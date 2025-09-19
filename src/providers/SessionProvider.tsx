import React, { useEffect } from 'react';
import { supabase } from '../shared/lib/supabase';
import { useSession, type Profile } from '../state/useSession';
import Config from 'react-native-config';
// (optional) if you use React Query, import your client and clear on auth changes
// import { queryClient } from "../shared/lib/queryClient";

type ID = string | number; // keep consistent with your store

// ---- helpers ----
async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ''}` };
}

type MeResponse = {
  profileId?: ID;
  businessId?: ID;
  profile?: Profile; // <-- now included
};

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${Config.API_BASE}/me`, {
    headers: await authHeader(),
  });
  if (res.status === 401) {
    // token is invalid on server side, sign out locally too
    await supabase.auth.signOut();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to load /me');
  return res.json();
}

// ---- provider ----
export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setSignedOut = useSession(s => s.setSignedOut);
  const setSignedIn = useSession(s => s.setSignedIn);
  const setIds = useSession(s => s.setIds);
  const setBootstrapped = useSession(s => s.setBootstrapped);
  const hardReset = useSession(s => s.hardReset);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Cold start: what does Supabase say?
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSignedOut(); // status = signedOut, bootstrapped = true (per your store)
        return;
      }

      // Have a session → minimally set userId
      if (!cancelled) setSignedIn({ userId: session.user.id });

      // Resolve app-specific IDs (profile/business/profile) from your API
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setIds({
            profileId: me.profileId,
            businessId: me.businessId,
            profile: me.profile, // <-- pass profile through
          });
        }
      } finally {
        if (!cancelled) setBootstrapped(true); // nav can now decide what to render
      }
    })();

    // 2) Live updates: login/logout/token refresh
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session || event === 'SIGNED_OUT') {
          hardReset();
          // queryClient.clear?.(); // optional
          return;
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          if (!cancelled) setSignedIn({ userId: session.user.id });

          const me = await fetchMe().catch(() => ({} as MeResponse));
          if (!cancelled) {
            setIds({
              profileId: me.profileId,
              businessId: me.businessId,
              profile: me.profile, // <-- include profile here too
            });
          }
          // queryClient.clear?.(); // optional: avoid cross-user cache bleed
        }
      },
    );

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
