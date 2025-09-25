// src/providers/SessionProvider.tsx
import React, { useEffect } from 'react';
import { supabase } from '../shared/lib/supabase';
import { useSession } from '../state/useSession';

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setSignedIn = useSession(s => s.setSignedIn);
  const setSignedOut = useSession(s => s.setSignedOut);
  const setBootstrapped = useSession(s => s.setBootstrapped);
  const hardReset = useSession(s => s.hardReset);
  const refreshMe = useSession(s => s.refreshMe);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setSignedOut();
          setBootstrapped(true);
        }
        return;
      }

      const uid = session.user.id;
      if (!cancelled) setSignedIn({ userId: uid });

      await refreshMe();
      if (!cancelled) setBootstrapped(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Signed out or no session -> clear everything immediately
        if (!session || event === 'SIGNED_OUT') {
          hardReset();
          return;
        }

        // Any “we’re now signed in / token changed / user updated”
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          setBootstrapped(false); // ⬅️ freeze UI while we hydrate
          const uid = session.user.id;
          setSignedIn({ userId: uid });
          await refreshMe();
          setBootstrapped(true); // ⬅️ unfreeze after entities loaded
        }
      },
    );

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, [setSignedIn, setSignedOut, setBootstrapped, hardReset, refreshMe]);

  return <>{children}</>;
}
