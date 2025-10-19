// src/shared/hooks/useLiveLocations.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type LiveRow = {
  profile_id: number;
  driver_id: number;
  business_id: number;
  route_id: number | null;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  source?: string | null;
  client_ts: string; // device timestamp (ISO)
  created_at: string; // db default
  updated_at: string; // trigger
  battery_pct?: number | null;
};

type MapByProfile = Record<number, LiveRow>;

function upsert(map: MapByProfile, row: LiveRow) {
  return { ...map, [row.profile_id]: row };
}
function drop(map: MapByProfile, profile_id: number) {
  if (!(profile_id in map)) return map;
  const next = { ...map };
  delete next[profile_id];
  return next;
}

export function useLiveLocations(businessId?: number | null) {
  const [rowsMap, setRowsMap] = useState<MapByProfile>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial snapshot
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('driver_location_live')
        .select(
          'profile_id,driver_id,business_id,route_id,lat,lng,accuracy_m,source,client_ts,created_at,updated_at,battery_pct',
        )
        .eq('business_id', businessId);

      if (cancelled) return;
      if (!error && Array.isArray(data)) {
        const next: MapByProfile = {};
        for (const r of data as LiveRow[]) next[r.profile_id] = r;
        setRowsMap(next);
      } else {
        setRowsMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  // Realtime subscription
  useEffect(() => {
    if (!businessId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const chan = supabase.channel(`live:${businessId}`);
    channelRef.current = chan;

    chan
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_location_live',
          filter: `business_id=eq.${businessId}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            const profileId = (payload.old as any)?.profile_id;
            if (typeof profileId === 'number') {
              setRowsMap(prev => drop(prev, profileId));
            }
            return;
          }
          const row = (payload.new || payload.record) as LiveRow | undefined;
          if (!row) return;
          setRowsMap(prev => upsert(prev, row));
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [businessId]);

  const rows = useMemo(() => Object.values(rowsMap), [rowsMap]);

  return {
    rows, // LiveRow[]
    rowsMap, // Record<profile_id, LiveRow>
  };
}

// Helpers
export function lastSeenText(iso?: string | null) {
  if (!iso) return 'Last seen: —';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return 'Last seen: just now';
  if (mins === 1) return 'Last seen: 1 min ago';
  return `Last seen: ${mins} mins ago`;
}

export function initialsFrom(name?: string) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'DR';
}
