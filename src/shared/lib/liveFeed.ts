// src/shared/lib/liveFeed.ts
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getOneFix } from './locations';

type Ctx = {
  profileId: number;
  driverId: number;
  businessId: number;
  routeId?: number | null;
  isClockedIn: () => boolean;
  periodMs?: number; // default ~1500ms
  service_date?: string | null;
};

let timer: NodeJS.Timer | null = null;
let lastSentAt = 0;
let appState = AppState.currentState;

const QKEY = 'mv_loc_offline_q_v1';

async function flushQueue() {
  const raw = await AsyncStorage.getItem(QKEY);
  if (!raw) return;
  const queue: any[] = JSON.parse(raw);
  if (!Array.isArray(queue) || queue.length === 0) return;

  // Try batch insert with upsert semantics
  for (const payload of queue) {
    await supabase
      .from('driver_location_live')
      .upsert(payload, { onConflict: 'profile_id' });
  }
  await AsyncStorage.removeItem(QKEY);
}

async function enqueue(payload: any) {
  const raw = (await AsyncStorage.getItem(QKEY)) || '[]';
  const q = JSON.parse(raw);
  q.push(payload);
  // cap queue to avoid runaway
  if (q.length > 200) q.splice(0, q.length - 200);
  await AsyncStorage.setItem(QKEY, JSON.stringify(q));
}

export function startLiveFeed(ctx: Ctx) {
  stopLiveFeed();

  const period = ctx.periodMs ?? 1500;

  const netUnsub = NetInfo.addEventListener(state => {
    if (state.isConnected) void flushQueue();
  });
  const appUnsub = AppState.addEventListener('change', s => {
    if (appState.match(/inactive|background/) && s === 'active') {
      void flushQueue();
    }
    appState = s;
  });

  const gate = () => (ctx.isClockedIn ? !!ctx.isClockedIn() : true);

  // One immediate attempt so you don't wait 1.5s
  (async () => {
    try {
      if (!gate()) {
        /* console.log('[live] gated off'); */ return;
      }
      const fix = await getOneFix();
      if (!fix.ok) {
        /* console.log('[live] no fix yet'); */ return;
      }
      const payload = {
        profile_id: ctx.profileId,
        driver_id: ctx.driverId,
        business_id: ctx.businessId,
        route_id: ctx.routeId ?? null,
        service_date: ctx.service_date ?? null,
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy_m: fix.coords.accuracy ?? null,
        client_ts: new Date(fix.timestamp).toISOString(),
        source: 'rn-interval-first',
      };
      await supabase
        .from('driver_location_live')
        .upsert(payload, { onConflict: 'profile_id' })
        .throwOnError();
      lastSentAt = Date.now();
      // console.log('[live] first upsert ok');
    } catch (e) {
      // console.log('[live] first upsert failed', e);
    }
  })();

  timer = setInterval(async () => {
    if (!gate()) return;

    const now = Date.now();
    if (now - lastSentAt < period - 100) return;

    const fix = await getOneFix();
    if (!fix.ok) return;

    const payload = {
      profile_id: ctx.profileId,
      driver_id: ctx.driverId,
      business_id: ctx.businessId,
      route_id: ctx.routeId ?? null,
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      accuracy_m: fix.coords.accuracy ?? null,
      client_ts: new Date(fix.timestamp).toISOString(),
      source: 'rn-interval',
    };

    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueue(payload);
        return;
      }
      await supabase
        .from('driver_location_live')
        .upsert(payload, { onConflict: 'profile_id' })
        .throwOnError();
      lastSentAt = now;
      // console.log('[live] upsert ok');
    } catch (e) {
      await enqueue(payload);
      // console.log('[live] queued (error)', e);
    }
  }, period);

  return () => {
    netUnsub();
    appUnsub.remove();
  };
}

export function stopLiveFeed() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
