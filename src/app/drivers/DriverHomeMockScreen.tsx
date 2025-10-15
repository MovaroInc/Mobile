// src/app/driver/DriverTodayScreen.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import {
  Navigation as NavIcon,
  Phone,
  Clock,
  MapPin,
  CheckCircle,
  Play,
  PauseCircle,
  Info as InfoIcon,
  X,
  RefreshCcw,
  Map as MapIcon,
} from 'react-native-feather';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  createTimeEntry,
  grabDriverLastEntryPriorToday,
  grabDriverTimeEntries,
  updateTimeEntry,
} from '../../shared/lib/ImageHelpers';
import { useSession } from '../../state/useSession';
import {
  grabRouteBreaks,
  grabRouteProfileAndDate,
  newRouteBreak,
  updateRouteBreak,
  updateRouter,
} from '../../shared/lib/RouteHelpers';
import { updateStopStatus } from '../../shared/lib/StopsHelpers';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

/* ───────────────── types ───────────────── */

type StopStatus = 'scheduled' | 'en_route' | 'arrived' | 'completed';

type Stop = {
  id: number;
  name?: string;
  business_name?: string;
  address?: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country_code?: string | null;
  window?: string | null;
  eta?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  status: StopStatus;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sequence?: number | null;
  order?: number | null;
  order_index?: number | null;
  id_required?: boolean | null;
  access_info?: string | null;
  access_code?: string | null;
  requirements?: string[] | null;
};

type RouteRecord = {
  id: number;
  name: string;
  service_date: string; // YYYY-MM-DD
  planned_start_at?: string | null;
  planned_start_at_local_hm?: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  progress?: number | null;
  distance_remaining_km?: number | null;
  time_remaining_min?: number | null;
  driver_name?: string | null;
  vehicle?: string | null;
  driver_display?: 'full' | 'single' | null;
  auto_trigger_stops?: boolean | null;
  stops?: Stop[] | null;
};

/* ───────────────── helpers ───────────────── */

function hhmmFromISO(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(m).padStart(2, '0');
  return `${h}:${mm} ${ampm}`;
}

const convertToYYYYMMDD = (date: string) => {
  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
};

const todayLocalYYYYMMDD = convertToYYYYMMDD(new Date().toLocaleDateString());
console.log('todays date', todayLocalYYYYMMDD);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function sortStopsBySequence(list: Stop[] = []) {
  return [...list].sort((a, b) => {
    const sa = (a.sequence ??
      a.order ??
      a.order_index ??
      Number.MAX_SAFE_INTEGER) as number;
    const sb = (b.sequence ??
      b.order ??
      b.order_index ??
      Number.MAX_SAFE_INTEGER) as number;
    return sa - sb;
  });
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#6B7280' },
  en_route: { label: 'En Route', color: '#3B82F6' },
  arrived: { label: 'Arrived', color: '#F59E0B' },
  completed: { label: 'Done', color: '#10B981' },
};

function statusColor(status?: string | null) {
  return (status && STATUS_META[status]?.color) || '#6B7280';
}

/* ───────────────── utilities (FIXED alert-to-promise) ───────────────── */

function confirmAsync({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  cancelable = false,
}: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  cancelable?: boolean;
}) {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable },
    );
  });
}

function firstEntry(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

/* ───────────────── screen ───────────────── */

export default function DriverTodayScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile, business } = useSession();

  const [breakOn, setBreakOn] = useState(false);
  const [loading, setLoading] = useState(true);

  const [clockedIn, setClockedIn] = useState(false);
  const [timeEntry, setTimeEntry] = useState<any[]>([]);
  const [yesterdayTimeEntry, setYesterdayTimeEntry] = useState<any[]>([]);

  const [route, setRoute] = useState<RouteRecord | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);

  const [currentStop, setCurrentStop] = useState<Stop | null>(null);
  const [nextStop, setNextStop] = useState<Stop | null>(null);
  const [remainingCount, setRemainingCount] = useState<number>(0);

  const [needsCloseFromYesterday, setNeedsCloseFromYesterday] = useState(false);
  const [allDoneToday, setAllDoneToday] = useState(false);

  // prevent "No route" flash: only show empty when a fetch was actually attempted
  const [routeAttempted, setRouteAttempted] = useState(false);

  const [closedTimeSheet, setClosedTimeSheet] = useState(false);

  // NEW: break tracking (limit to 1)
  const [allowedBreaks, setAllowedBreaks] = useState(false);
  const [breaks, setBreaks] = useState<
    {
      route_id: number;
      profile_id: number;
      business_id: number;
      started_at: string;
      ended_at: string | null;
      minutes: number;
    }[]
  >([]);
  const [currentBreak, setCurrentBreak] = useState<any | null>(null);

  // Auto-start banner state
  const [autoStart, setAutoStart] = useState<{
    stop: Stop;
    seconds: number;
  } | null>(null);
  const autoTimerRef = useRef<NodeJS.Timer | null>(null);
  const clearAutoTimer = () => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };
  useEffect(() => () => clearAutoTimer(), []);

  /* ─────────────── initial load (wait for profile.id) ─────────────── */
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const timesheetData = await checkTimesheet();

        // If timesheet exists and is open, fetch route
        if (timesheetData && timesheetData.length > 0) {
          await run();
        }
      };

      loadData();
    }, [profile?.id, business?.id]), // Add dependencies
  );

  useEffect(() => {
    console.log('needsCloseFromYesterday', needsCloseFromYesterday);
  }, [needsCloseFromYesterday]);

  /* ─────────────── helpers ─────────────── */

  const checkTimesheet = async () => {
    if (!profile?.id || !business?.id) return; // wait for session hydration

    setLoading(true);
    try {
      // 1) Check YESTERDAY for open entry
      const resY = await grabDriverLastEntryPriorToday(
        profile.id,
        todayLocalYYYYMMDD,
      );
      console.log('resY', resY);
      const yEntry = resY.data;
      if (yEntry) {
        setYesterdayTimeEntry(yEntry);
      }

      setNeedsCloseFromYesterday(!!yEntry && !yEntry.clock_out);

      // 2) Check TODAY timesheet
      console.log('today', todayLocalYYYYMMDD);
      const resToday = await grabDriverTimeEntries(
        profile.id,
        todayLocalYYYYMMDD,
      );
      console.log('resToday', resToday.data);

      if (resToday.data[0].clock_in && resToday.data[0].clock_out) {
        console.log('closedTimeSheet', resToday.data);
        setClosedTimeSheet(true);
      }

      const isClockedIn =
        !!resToday?.success && (resToday.data?.length ?? 0) > 0;

      // NOTE: do NOT read `clockedIn` here; it's stale this tick.
      // Route will be fetched by the effect below when `clockedIn` flips true.
      if (!isClockedIn) {
        setRoute(null);
        setStops([]);
        setRouteAttempted(false);
        return null;
      } else {
        setTimeEntry(resToday?.data ?? []);
        setClockedIn(isClockedIn);
        return resToday.data;
      }
    } catch (e) {
      setTimeEntry([]);
      setClockedIn(false);
      setRoute(null);
      setStops([]);
      setRouteAttempted(false);
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    console.log('called run');
    try {
      const res = await grabRouteProfileAndDate(profile.id, todayLocalYYYYMMDD);
      const r: RouteRecord | null = res?.success ? res.data ?? null : null;
      console.log('todays route response', res);
      setRoute(r);
      setAllowedBreaks(r?.allowed_breaks ?? false);
      const sorted = sortStopsBySequence(r?.stops ?? []);
      setStops(sorted);
      setRouteAttempted(true);
      await checkForStopAndAutoStart(sorted, r!);
    } catch {
      setRoute(null);
      setStops([]);
      setRouteAttempted(true);
    }
  };

  useEffect(() => {
    if (!route?.id) return;
    grabAllRouteBreaks();
  }, [route?.id]);

  const grabAllRouteBreaks = async () => {
    const res = await grabRouteBreaks(route?.id ?? 0);
    console.log('grabAllRouteBreaks res', res);

    const list = Array.isArray(res?.data) ? res.data : [];
    setBreaks(list);

    // consider common field names for start/end
    console.log('list', list);
    const hasOpenBreak = list.some((b: any) => {
      const start =
        b?.start ?? b?.started ?? b?.start_time ?? b?.begin ?? b?.clock_in;
      const end =
        b?.end ?? b?.ended ?? b?.end_time ?? b?.finish ?? b?.clock_out;
      return !!start && !end;
    });

    console.log('hasOpenBreak', hasOpenBreak);
    setBreakOn(hasOpenBreak);
    setCurrentBreak(
      list.find((b: any) => {
        const start =
          b?.start ?? b?.started ?? b?.start_time ?? b?.begin ?? b?.clock_in;
        const end =
          b?.end ?? b?.ended ?? b?.end_time ?? b?.finish ?? b?.clock_out;
        return !!start && !end;
      }),
    );
  };

  const addNewRouteBreak = async () => {
    if (!route?.id || !profile?.id || !business?.id) return;
    if (breaks.length < (route.allowed_breaks ?? 0)) {
      const res = await newRouteBreak({
        route_id: route?.id ?? 0,
        profile_id: profile?.id ?? 0,
        business_id: business?.id ?? 0,
        started: new Date().toISOString(),
      });
      console.log('addNewRouteBreak res', res);
      grabAllRouteBreaks();
    } else {
      Alert.alert(
        'Limit Reached',
        'You have reached the maximum number of breaks for this route.',
      );
    }
  };

  const stopBreak = async () => {
    if (!route?.id || !profile?.id || !business?.id) return;

    if (breakOn) {
      const nowIso = new Date().toISOString();

      // Compute minutes between currentBreak.started and now
      let minutes_lapsed: number | undefined;
      if (currentBreak?.started) {
        const startMs = new Date(currentBreak.started).getTime();
        const endMs = Date.now();
        if (!isNaN(startMs)) {
          minutes_lapsed = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
      }

      await updateRouteBreak(currentBreak?.id ?? 0, {
        ended: nowIso,
        ...(typeof minutes_lapsed === 'number' ? { minutes_lapsed } : {}),
      });

      grabAllRouteBreaks();
    }
  };

  const markEnrouteLocal = (id: number) => {
    setStops(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'en_route' } : s)),
    );
    setRoute(r => (r ? { ...r, status: 'in_progress' } : r));
  };

  const closeEntryNow = async (entryId: number) => {
    await updateTimeEntry(entryId, {
      clock_out: new Date().toISOString(),
      status: 'closed',
    });
  };

  const closeEntryFromYesterday = async () => {
    const res = await updateTimeEntry(yesterdayTimeEntry.id, {
      clock_out: new Date().toISOString(),
      status: 'closed',
    });
    console.log('closeEntryFromYesterday res', res);
    setYesterdayTimeEntry(res.data);
    if (res.success) {
      setNeedsCloseFromYesterday(res.data.clock_out === null);
    }
  };

  // Utility: minutes between two ISO timestamps (rounded to nearest whole minute)
  const minutesBetween = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso || !endIso) return 0;
    const a = new Date(startIso).getTime();
    const b = new Date(endIso).getTime();
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, Math.round((b - a) / 60000));
  };

  // Sum all break minutes from local state (handles open & closed breaks)
  const sumBreakMinutes = (
    allBreaks: Array<{
      started?: string;
      ended?: string;
      minutes_lapsed?: number;
    }>,
    nowIso: string,
  ) => {
    if (!Array.isArray(allBreaks) || allBreaks.length === 0) return 0;

    return allBreaks.reduce((sum, br) => {
      // Prefer an explicit minutes_lapsed if present and finite
      if (
        typeof br.minutes_lapsed === 'number' &&
        isFinite(br.minutes_lapsed) &&
        br.minutes_lapsed >= 0
      ) {
        return sum + Math.round(br.minutes_lapsed);
      }
      // Otherwise compute from started → (ended || now)
      const end = br.ended || nowIso;
      return sum + minutesBetween(br.started, end);
    }, 0);
  };

  // Build the single payload for the server
  const buildClockOutPayload = ({
    clockInIso,
    breaksList,
  }: {
    clockInIso?: string | null;
    breaksList: Array<{
      started?: string;
      ended?: string;
      minutes_lapsed?: number;
    }>;
  }) => {
    const nowIso = new Date().toISOString();

    const duration_minutes = minutesBetween(clockInIso, nowIso);
    const break_minutes_total = sumBreakMinutes(breaksList, nowIso);

    return {
      clock_out: nowIso,
      status: 'closed',
      duration_minutes,
      break_minutes_total,
      // lunch minutes: to be handled by you later (per your note)
    };
  };

  /* ─────────────── actions ─────────────── */

  const handleClockOut = async () => {
    try {
      // Guard: need an open time entry
      console.log('timeEntry', timeEntry);
      const current = timeEntry[0];
      if (!current?.id || !current?.clock_in) {
        Alert.alert(
          'No open timesheet',
          'Could not find an active time entry to close.',
        );
        return;
      }

      // Build the one-and-only payload from local state
      const payload = buildClockOutPayload({
        clockInIso: current.clock_in,
        breaksList: breaks || [], // make sure `breaks` is your local state array
      });

      // Single server call
      const res = await updateTimeEntry(current.id, payload);

      if (!res?.success) {
        Alert.alert('Clock out failed', res?.message || 'Please try again.');
        return;
      }

      checkTimesheet();
      Alert.alert('Clocked out', 'Your time has been recorded.');
    } catch (e: any) {
      Alert.alert('Clock out failed', e?.message || 'Please try again.');
    }
  };

  const handleClockIn = async () => {
    try {
      setLoading(true);

      // Re-check yesterday before allowing a new entry
      const resY = await grabDriverLastEntryPriorToday(
        profile?.id ?? 0,
        todayLocalYYYYMMDD,
      );
      const yEntry = resY.data;
      if (
        yEntry &&
        !yEntry.clock_out &&
        (yEntry.status === 'open' || yEntry.status === 'OPEN')
      ) {
        const proceed = await confirmAsync({
          title: 'Yesterday Clock Out',
          message:
            'You still have an open entry from yesterday. Clock out now so you can clock in today?',
          confirmText: 'Clock Out',
          cancelText: 'Cancel',
        });

        if (!proceed) {
          setLoading(false);
          return;
        }

        await closeEntryNow(yEntry.id);
      }

      const res = await createTimeEntry({
        business_id: business.id,
        profile_id: profile.id,
        selected_date: todayLocalYYYYMMDD,
        clock_in: new Date().toISOString(),
        clock_out: null,
        status: 'open',
        duration_minutes: null,
        source: 'app',
        notes: 'Clocked in from driver app',
      });

      if (res?.success) {
        setTimeEntry(res.data || []);
        setClockedIn(true); // route fetch will be triggered by the effect
        run();
      } else {
        Alert.alert('Clock in failed', res?.message || 'Try again.');
      }
    } catch (e: any) {
      Alert.alert('Clock in failed', e?.message || 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleBreak = () => setBreakOn(v => !v);

  const navigateTo = async (s: Stop) => {
    const lat = (s as any).latitude ?? (s as any).lat;
    const lng = (s as any).longitude ?? (s as any).lng;
    const label = encodeURIComponent(
      s.name || s.business_name || 'Destination',
    );

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return Alert.alert('Missing coordinates');
    }

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    const tryOpen = async (url: string) => {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return true;
        }
      } catch {}
      return false;
    };

    if (Platform.OS === 'ios') {
      const gmaps = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      if (await tryOpen(gmaps)) return;
      const apple = `maps://?daddr=${lat},${lng}&dirflg=d`;
      if (await tryOpen(apple)) return;
      await Linking.openURL(webUrl);
    } else {
      const gnav = `google.navigation:q=${lat},${lng}&mode=d`;
      if (await tryOpen(gnav)) return;
      const geo = `geo:0,0?q=${lat},${lng}(${label})`;
      if (await tryOpen(geo)) return;
      await Linking.openURL(webUrl);
    }
  };

  const call = (phone?: string | null) => {
    const p = phone ?? currentStop?.contact_phone ?? currentStop?.phone;
    if (!p) return;
    Linking.openURL(`tel:${p}`);
  };

  /* ─────────────── auto-start logic ─────────────── */

  const cancelAutoStart = () => {
    clearAutoTimer();
    setAutoStart(null);
  };

  const doAutoStartStop = async (stop: Stop, r: RouteRecord) => {
    try {
      await updateStopStatus(stop.id, { status: 'en_route' });
      await updateRouter(r.id, {
        status: 'in_progress',
      });
      markEnrouteLocal(stop.id);
      navigation.navigate(
        'Stop' as never,
        { stop: { ...stop, status: 'en_route' } } as never,
      );
    } catch (e: any) {
      Alert.alert('Auto start failed', e?.message || 'Please try again.');
    } finally {
      clearAutoTimer();
      setAutoStart(null);
    }
  };

  const startManualStop = async (stop: Stop, r?: RouteRecord | null) => {
    const routeRef = r ?? route;
    if (!routeRef) return;
    try {
      await updateStopStatus(stop.id, { status: 'en_route' });
      markEnrouteLocal(stop.id);
      navigation.navigate(
        'Stop' as never,
        { stop: { ...stop, status: 'en_route' } } as never,
      );
    } catch (e: any) {
      Alert.alert('Failed to start', e?.message || 'Please try again.');
    }
  };

  const goToRoute = async (r: Stop) => {
    console.log('goToRoute', r);
    navigation.navigate(
      'Stop' as never,
      {
        stop: r,
      } as never,
    );
  };

  const refreshToday = async () => {
    if (!profile?.id || !business?.id) return;

    try {
      // setRefreshing(true);
      clearAutoTimer(); // don’t double-run the countdown
      setAutoStart(null);

      const resToday = await grabDriverTimeEntries(
        profile.id,
        todayLocalYYYYMMDD,
      );
      const todayEntries = resToday?.data ?? [];
      setTimeEntry(todayEntries);
      const isIn = !!resToday?.success && todayEntries.length > 0;
      setClockedIn(isIn);

      // 3) (Re)fetch today’s route
      try {
        const rRes = await grabRouteProfileAndDate(
          profile.id,
          todayLocalYYYYMMDD,
        );
        const r: RouteRecord | null = rRes?.success ? rRes.data ?? null : null;
        setRoute(r);
        const sorted = sortStopsBySequence(r?.stops ?? []);
        setStops(sorted);
        setRouteAttempted(true);

        if (isIn && r) {
          await checkForStopAndAutoStart(sorted, r);
        }

        // If a route exists but the driver isn’t clocked in, give a helpful nudge.
        if (!isIn && r) {
          Alert.alert(
            'Route assigned',
            'A route is assigned for today. Clock in to view and start your stops.',
          );
        }
      } catch {
        setRoute(null);
        setStops([]);
        setRouteAttempted(true);
      }
    } catch (e: any) {
      Alert.alert('Refresh failed', e?.message || 'Please try again.');
    }
  };

  const checkForStopAndAutoStart = async (list: Stop[], r: RouteRecord) => {
    if (!r || !Array.isArray(list)) return;

    const isStopDone = (s: Stop) =>
      String(s.status).toLowerCase() === 'completed' ||
      String(s.status).toLowerCase() === 'closed';

    const sorted = sortStopsBySequence(list);

    // If there are no stops at all, treat as not-done (could be "no route")
    if (sorted.length === 0) {
      setCurrentStop(null);
      setNextStop(null);
      setRemainingCount(0);
      setAllDoneToday(false); // nothing assigned, not the same as "all done"
      return;
    }

    // Count remaining (not done yet)
    const remaining = sorted.filter(s => !isStopDone(s));
    setRemainingCount(remaining.length);

    // If nothing remains, we're all done
    if (remaining.length === 0) {
      setCurrentStop(null);
      setNextStop(null);
      setAllDoneToday(true);
      clearAutoTimer();
      setAutoStart(null);
      await updateRoute;
      return;
    }

    // From here on, there IS work left
    setAllDoneToday(false);

    // Prefer an active stop (en_route or arrived)
    const active = remaining.find(
      s =>
        String(s.status).toLowerCase() === 'en_route' ||
        String(s.status).toLowerCase() === 'arrived',
    );

    if (active) {
      setCurrentStop(active);
      setNextStop(
        remaining.find(s => (s.sequence ?? 0) > (active.sequence ?? -1)) ??
          null,
      );
      if (r?.auto_trigger_stops) {
        navigation.navigate('Stop' as never, { stop: active } as never);
      }
      return;
    }

    // Otherwise pick the next scheduled (or any remaining) stop
    const next =
      remaining.find(s => String(s.status).toLowerCase() === 'scheduled') ??
      remaining[0];

    if (!next) {
      // Safety: should have been caught by remaining.length === 0
      setCurrentStop(null);
      setNextStop(null);
      setAllDoneToday(true);
      clearAutoTimer();
      setAutoStart(null);
      return;
    }

    setCurrentStop(next);
    setNextStop(
      remaining.find(s => (s.sequence ?? 0) > (next.sequence ?? -1)) ?? null,
    );

    if (!r.auto_trigger_stops) {
      clearAutoTimer();
      setAutoStart(null);
      return;
    }
    if (autoStart?.stop?.id === next.id && autoStart.seconds > 0) return;

    setAutoStart({ stop: next, seconds: 5 });
    clearAutoTimer();
    autoTimerRef.current = setInterval(() => {
      setAutoStart(prev => {
        if (!prev) return null;
        const remaining = prev.seconds - 1;
        if (remaining <= 0) {
          clearAutoTimer();
          void doAutoStartStop(prev.stop, r);
          return null;
        }
        return { ...prev, seconds: remaining };
      });
    }, 1000);
  };

  /* ─────────────── derived ─────────────── */

  useEffect(() => {
    const open = stops.filter(s => s.status !== 'completed');
    setCurrentStop(open[0] ?? null);
    setNextStop(open[1] ?? null);
    setRemainingCount(open.length);
  }, [stops]);

  const driverDisplay: 'full' | 'single' = (
    route?.driver_display === 'full' || route?.driver_display === 'single'
      ? route.driver_display
      : 'single'
  ) as 'full' | 'single';

  const firstName =
    profile?.first_name || route?.driver_name?.split(' ')?.[0] || 'there';

  /* ─────────────── UI ─────────────── */

  if (loading) {
    return (
      <View
        style={[
          tw`flex-1 items-center justify-center`,
          { backgroundColor: colors.bg },
        ]}
      >
        <ActivityIndicator />
        <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
          Loading…
        </Text>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-5 pb-3`}>
        <Text style={[tw`text-xl`, { color: colors.muted }]}>
          Good {greeting()}, {firstName}
        </Text>
        <View style={tw`flex-row items-end justify-between`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            {clockedIn ? 'Your day at a glance' : 'Start your day'}
          </Text>
          <TouchableOpacity
            onPress={() => {}}
            style={[
              tw`p-2 rounded-2 border`,
              {
                borderColor: colors.border,
                backgroundColor: colors.borderSecondary,
              },
            ]}
          >
            <MapIcon
              height={16}
              width={16}
              style={tw`mr-1`}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Time/Break strip */}

      {needsCloseFromYesterday ? (
        <>
          <View
            style={[
              tw`mx-4 mb-3 px-3 py-2 rounded-2xl flex-row items-center justify-between`,
              { backgroundColor: colors.border },
            ]}
          >
            <View style={tw`flex-1 mr-4`}>
              <Text style={[tw`text-xs`, { color: colors.muted }]}>
                Open Timesheet
              </Text>
              <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                Close previous timesheet
              </Text>
            </View>
            <TinyButton
              label="Close"
              onPress={closeEntryFromYesterday}
              colors={colors}
              LeftIcon={Play}
            />
          </View>
          <View style={tw`mx-4`}>
            <InfoBanner
              text="You have a previously open timesheet that has not been closed. You
              must close the previous timesheet in order to click in today."
              colors={colors}
            />
          </View>
        </>
      ) : (
        <View
          style={[
            tw`mx-4 mb-3 px-3 py-2 rounded-2xl flex-row items-center justify-between`,
            { backgroundColor: colors.border },
          ]}
        >
          <View>
            <Text style={[tw`text-xs`, { color: colors.muted }]}>
              Time Status
            </Text>
            <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
              {closedTimeSheet
                ? `Clocked out: ${hhmmFromISO(timeEntry?.[0]?.clock_out)}`
                : clockedIn || allDoneToday
                ? breakOn
                  ? 'On Break'
                  : `Clocked in: ${hhmmFromISO(timeEntry?.[0]?.clock_in)}`
                : 'Clocked out'}
            </Text>
          </View>
          {!allDoneToday ? (
            <>
              {clockedIn ? (
                <>
                  {!route ? (
                    <TinyButton
                      label="Clock Out"
                      onPress={() => {}}
                      colors={colors}
                      LeftIcon={Play}
                    />
                  ) : (
                    <TinyButton
                      label={breakOn ? 'End Break' : 'Start Break'}
                      onPress={breakOn ? stopBreak : addNewRouteBreak}
                      colors={colors}
                      LeftIcon={breakOn ? X : Play}
                    />
                  )}
                </>
              ) : (
                <TinyButton
                  label="Clock In"
                  onPress={handleClockIn}
                  colors={colors}
                  LeftIcon={Play}
                />
              )}
            </>
          ) : (
            <>
              {closedTimeSheet ? null : (
                <TinyButton
                  label="Clock Out"
                  onPress={handleClockOut}
                  colors={colors}
                  LeftIcon={Play}
                />
              )}
            </>
          )}
        </View>
      )}

      {/* ─────────────── ONLY show route content if clocked in ─────────────── */}
      {!clockedIn ? (
        <View />
      ) : !routeAttempted ? (
        // still trying to fetch route → show a lightweight loader instead of "No route"
        <View style={[tw`flex-1 items-center justify-center`]}>
          <ActivityIndicator />
          <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
            Fetching your route…
          </Text>
        </View>
      ) : !route ? (
        <EmptyState
          title="No route assigned today"
          message="Please contact your manager for today’s assignment."
          colors={colors}
        />
      ) : (
        <>
          {/* Route summary */}
          {closedTimeSheet ? (
            <View style={tw`px-4`}>
              <InfoBanner
                text="You have clocked out. Todays route is complete. If you clocked out by mistake, you can contact your manager to re-open your timesheet."
                colors={colors}
              />
            </View>
          ) : (
            <>
              <View style={tw`px-4`}>
                <View
                  style={[
                    tw`rounded-2xl p-3 mb-2`,
                    {
                      backgroundColor: colors.borderSecondary || colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      tw`text-base font-semibold`,
                      { color: colors.text },
                    ]}
                  >
                    {route.name || 'Today’s Route'}
                  </Text>
                  <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                    Today • Start{' '}
                    {route.planned_start_at_local_hm ??
                      hhmmFromISO(route.planned_start_at)}
                  </Text>

                  {/* Progress bar */}
                  <View
                    style={[
                      tw`h-2 rounded-full mt-3`,
                      { backgroundColor: '#1f2937' },
                    ]}
                  >
                    <View
                      style={{
                        width: `${Math.round((route.progress ?? 0) * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        backgroundColor: '#2563eb',
                      }}
                    />
                  </View>

                  <View style={tw`flex-row mt-3`}>
                    <Stat
                      label="Stops left"
                      value={`${String(remainingCount ?? 0)} / ${String(
                        stops.length,
                      )}`}
                      colors={colors}
                    />
                    <View style={tw`w-3`} />
                    <Stat
                      label="Dist. left"
                      value={
                        route.distance_remaining_km != null
                          ? `${route.distance_remaining_km.toFixed(1)} km`
                          : '—'
                      }
                      colors={colors}
                    />
                    <View style={tw`w-3`} />
                    <Stat
                      label="ETA"
                      value={
                        route.time_remaining_min != null
                          ? `${route.time_remaining_min} min`
                          : '—'
                      }
                      colors={colors}
                    />
                  </View>
                </View>

                {/* Auto-start countdown banner */}
                {autoStart ? (
                  <View
                    style={[
                      tw`mx-0 mt-2 px-3 py-2 rounded-xl flex-row items-center justify-between`,
                      { backgroundColor: '#0f172a' },
                    ]}
                  >
                    <View style={tw`flex-1 pr-2`}>
                      <Text style={[tw`text-xs`, { color: '#9CA3AF' }]}>
                        Next stop auto-starts in{' '}
                        <Text style={tw`text-white font-bold`}>
                          {autoStart.seconds}s
                        </Text>
                      </Text>
                      <Text
                        style={[tw`text-sm font-semibold`, { color: 'white' }]}
                        numberOfLines={1}
                      >
                        {autoStart.stop.business_name ||
                          autoStart.stop.name ||
                          'Next stop'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={cancelAutoStart}
                      style={[
                        tw`px-3 py-1.5 rounded-lg`,
                        { backgroundColor: '#1f2937' },
                      ]}
                    >
                      <Text
                        style={[tw`text-xs font-semibold`, { color: '#fff' }]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {(stops?.length || 0) === 0 ? (
                  <InfoBanner
                    colors={colors}
                    text="You have no stops on your route."
                  />
                ) : null}
              </View>
            </>
          )}

          {/* Full schedule */}
          <View style={tw`flex-1 pt-1 w-full`}>
            <View
              style={tw`px-4 mt-3 mb-2 flex-row items-center justify-between`}
            >
              <Text
                style={[tw`text-base font-semibold`, { color: colors.text }]}
              >
                Today’s Stops
              </Text>
              <TouchableOpacity onPress={refreshToday}>
                <RefreshCcw
                  height={16}
                  width={16}
                  style={tw`mr-1`}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            <View style={tw`px-4 flex-1 mb-4`}>
              <View
                style={[
                  tw`rounded-2 overflow-hidden p-2 flex-1 pt-4`,
                  { backgroundColor: colors.borderSecondary },
                ]}
              >
                <FlatList
                  data={stops}
                  keyExtractor={s => String(s.id)}
                  style={tw`flex-1`}
                  ItemSeparatorComponent={() => <View style={tw`h-2`} />}
                  renderItem={({ item }) => (
                    <StopRow
                      item={item}
                      colors={colors}
                      activeRouteId={route?.id ?? null}
                      rowRouteId={route?.id ?? null}
                      currentStopId={currentStop?.id ?? null}
                      onHeadToStop={() => startManualStop(item, route)}
                      onGoToRoute={goToRoute}
                      onCall={() => call(item.contact_phone ?? item.phone)}
                    />
                  )}
                />
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/* ───────────────── small UI components ───────────────── */

function EmptyState({
  title,
  message,
  colors,
}: {
  title: string;
  message: string;
  colors: any;
}) {
  return (
    <View style={tw`flex-1 items-center justify-center px-8`}>
      <Text style={[tw`text-lg font-semibold`, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[tw`text-xs mt-1 text-center`, { color: colors.muted }]}>
        {message}
      </Text>
    </View>
  );
}

function InfoBanner({ text, colors }: { text: string; colors: any }) {
  return (
    <View
      style={[
        tw`flex-row items-center px-3 py-2 rounded-xl mb-2`,
        { backgroundColor: colors.border },
      ]}
    >
      <InfoIcon width={14} height={14} color={colors.muted} />
      <Text style={[tw`ml-2 mr-4 text-xs`, { color: colors.muted }]}>
        {text}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      style={[tw`flex-1 px-3 py-3 rounded-xl`, { backgroundColor: '#0f172a' }]}
    >
      <Text style={[tw`text-2xs`, { color: '#9CA3AF' }]}>{label}</Text>
      <Text style={[tw`text-lg font-bold mt-0.5`, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function TinyButton({
  label,
  onPress,
  colors,
  LeftIcon,
}: {
  label: string;
  onPress: () => void;
  colors: any;
  LeftIcon?: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-1.5 rounded-xl flex-row items-center`,
        { backgroundColor: colors.brand?.primary || '#2563eb' },
      ]}
    >
      {LeftIcon ? <LeftIcon width={14} height={14} color="#fff" /> : null}
      <Text style={tw`text-white text-xs font-semibold ml-1`}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusChip({ status, colors }: { status: StopStatus; colors: any }) {
  const conf = STATUS_META[status] ?? {
    label: String(status),
    color: '#6B7280',
  };
  return (
    <View
      style={[tw`px-2 py-0.5 rounded-full`, { backgroundColor: conf.color }]}
    >
      <Text style={tw`text-white text-2xs font-semibold`}>{conf.label}</Text>
    </View>
  );
}

function ActionPill({
  label,
  onPress,
  colors,
  LeftIcon,
}: {
  label: string;
  onPress: () => void;
  colors: any;
  LeftIcon?: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-2 py-1 rounded-lg flex-row items-center`,
        { backgroundColor: '#0f172a' },
      ]}
    >
      {LeftIcon ? <LeftIcon width={14} height={14} color={'#9CA3AF'} /> : null}
      <Text style={[tw`text-2xs font-semibold ml-1`, { color: '#9CA3AF' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ––––– Stop rows ––––– */

function StopRow({
  item,
  colors,
  activeRouteId,
  rowRouteId,
  currentStopId,
  onHeadToStop,
  onCall,
  onGoToRoute,
}: {
  item: Stop;
  colors: any;
  activeRouteId?: number | null;
  rowRouteId?: number | null;
  currentStopId?: number | null;
  onHeadToStop: () => void;
  onCall: () => void;
  onGoToRoute: (r: RouteRecord) => void;
}) {
  const isCurrentRoute =
    !rowRouteId || !activeRouteId ? true : rowRouteId === activeRouteId;
  const isCurrentStop = currentStopId != null && item.id === currentStopId;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {}}
      style={[
        tw`px-3 pb-2 rounded-xl`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      <View style={tw`flex-row items-start justify-start`}>
        <View style={tw`flex-row items-center`}>
          <View>
            <View
              style={[
                tw`w-4 h-4 rounded-full mt-1`,
                { backgroundColor: colors.brand?.primary },
              ]}
            />
            <View
              style={[
                tw`w-4 flex-1 rounded-full mt-2`,
                { backgroundColor: colors.border },
              ]}
            />
          </View>
        </View>
        <View style={tw`flex-1 ml-2`}>
          <View style={tw`flex-row items-center justify-between flex-1`}>
            <View style={tw`flex-row items-center`}>
              <Text
                style={[tw`text-base font-semibold`, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.business_name || item.name || 'Stop'}
              </Text>
              {isCurrentStop ? (
                <Text
                  style={[
                    tw`ml-2 px-2 py-0.5 rounded-full text-2xs font-semibold`,
                    { color: '#111827', backgroundColor: '#FDE68A' },
                  ]}
                >
                  Next stop
                </Text>
              ) : null}
            </View>
            <StatusChip status={item.status} colors={colors} />
          </View>
          <View style={tw`flex-row items-center mt-1`}>
            <MapPin width={14} height={14} color={colors.muted} />
            <Text
              style={[tw`ml-1 text-xs`, { color: colors.muted }]}
              numberOfLines={1}
            >
              {item.address_line1} {item.address_line2}, {item.city}{' '}
              {item.state || item.region} {item.country_code}
            </Text>
          </View>
          <View style={tw`flex-row items-center mt-1`}>
            <Clock width={14} height={14} color={colors.muted} />
            <Text style={[tw`ml-1 text-xs`, { color: colors.muted }]}>
              {item.eta ? `ETA ${item.eta}` : '—'}
            </Text>
          </View>

          <View style={tw`flex-row mt-2 justify-between`}>
            <View style={tw`flex-row`}>
              {isCurrentRoute && item.status === 'scheduled' ? (
                <ActionPill
                  label="Head to stop"
                  LeftIcon={NavIcon}
                  onPress={onHeadToStop}
                  colors={colors}
                />
              ) : (
                <>
                  {isCurrentRoute && item.status === 'arrived' ? (
                    <ActionPill
                      label="Continue to stop"
                      LeftIcon={NavIcon}
                      onPress={() => onGoToRoute(item)}
                      colors={colors}
                    />
                  ) : (
                    <View
                      style={[
                        tw`px-2 py-1 rounded-lg`,
                        { backgroundColor: '#0f172a', opacity: 0.5 },
                      ]}
                    >
                      <Text
                        style={[
                          tw`text-2xs font-semibold`,
                          { color: '#9CA3AF' },
                        ]}
                      >
                        Other route
                      </Text>
                    </View>
                  )}
                </>
              )}
              <View style={tw`w-2`} />
              {item.contact_phone || item.phone ? (
                <ActionPill
                  label="Call"
                  LeftIcon={Phone}
                  onPress={onCall}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
