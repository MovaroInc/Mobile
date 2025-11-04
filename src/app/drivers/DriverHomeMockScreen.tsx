// src/app/driver/DriverTodayScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Play,
  X,
  RefreshCcw,
  Map as MapIcon,
  Info as InfoIcon,
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

// permissions helpers & local persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLocationLevel,
  requestForegroundOnce,
  tryUpgradeToAlways,
  openAppSettings,
  onReturnFromSettings,
  isAlwaysLike,
  isWithinOneMile,
  getOneFix,
} from '../../shared/lib/locations';

// 🔴 IMPORTANT: no ".ts" extension here
import { startLiveFeed, stopLiveFeed } from '../../shared/lib/liveFeed';
import { getBusinessAdmin } from '../../shared/lib/BusinessHelpers';
import { sendNotification } from '../../shared/lib/notifications';
import StartGateMapCard from '../../shared/components/Map/StartGateMapCard';

const MAPBOX_TOKEN =
  'pk.eyJ1IjoibW92YWwiLCJhIjoiY21jZTJ1cnJrMDc3dTJrcHBwZzMyd2dhdSJ9.DFSiGfHa19L8vMK7muIr8A';

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
  allowed_breaks?: number | null;
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

function todayLocalYYYYMMDD(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const today = todayLocalYYYYMMDD();

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

/* ───────────────── screen ───────────────── */

export default function DriverTodayScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { profile, business } = useSession();

  const [breakOn, setBreakOn] = useState(false);
  const [loading, setLoading] = useState(true);

  const [clockedIn, setClockedIn] = useState(false);
  const [clockedOut, setClockedOut] = useState(false);
  const [timeEntry, setTimeEntry] = useState<any[]>([]);
  const [yesterdayTimeEntry, setYesterdayTimeEntry] = useState<any[]>([]);

  const [route, setRoute] = useState<RouteRecord | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [currentStop, setCurrentStop] = useState<Stop | null>(null);
  const [nextStop, setNextStop] = useState<Stop | null>(null);
  const [remainingCount, setRemainingCount] = useState<number>(0);

  const [startWithin1Mile, setStartWithin1Mile] = useState(false);

  const [needsCloseFromYesterday, setNeedsCloseFromYesterday] = useState(false);
  const [allDoneToday, setAllDoneToday] = useState(false);
  const [routeAttempted, setRouteAttempted] = useState(false);
  const [closedTimeSheet, setClosedTimeSheet] = useState(false);
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

  // Auto-start banner
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

  // Location permission modal state
  const [showLocModal, setShowLocModal] = useState(false);
  const [modalMode, setModalMode] = useState<'need_permission' | 'need_always'>(
    'need_permission',
  );
  const MODAL_KEY = 'mv_location_modal_dismissed_v1';

  // Re-check when returning from Settings
  useEffect(
    () =>
      onReturnFromSettings(() => {
        void recheckLocationGate();
      }),
    [],
  );

  // Check on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        await recheckLocationGate(); // check permission first
        const timesheetData = await checkTimesheet();
        if (timesheetData && timesheetData.id) {
          await run();
        } else {
          await validateWtihin1Mile();
        }
      };
      void loadData();
    }, [profile?.id, business?.id]),
  );

  /** Centralized gate check. Shows tutorial modal when needed. */
  const recheckLocationGate = useCallback(async () => {
    const dismissed = (await AsyncStorage.getItem(MODAL_KEY)) === '1';

    // 1) read current level
    let lvl = await getLocationLevel();

    // 2) if not authorized at all, try one foreground ask
    if (!lvl.authorized) {
      lvl = await requestForegroundOnce();
    }

    // 3) decide which modal to show
    if (!lvl.authorized) {
      if (!dismissed) {
        setModalMode('need_permission');
        setShowLocModal(true);
      }
      return;
    }

    // authorized but not “Always-like”
    if (!isAlwaysLike(lvl)) {
      if (!dismissed) {
        setModalMode('need_always');
        setShowLocModal(true);
      }
    } else {
      setShowLocModal(false);
    }
  }, []);

  /* ─────────────── data helpers ─────────────── */

  const checkTimesheet = async () => {
    if (!profile?.id || !business?.id) return;

    setLoading(true);
    try {
      const resY = await grabDriverLastEntryPriorToday(profile.id, today);
      const yEntry = resY.data;
      if (yEntry) setYesterdayTimeEntry(yEntry);
      setNeedsCloseFromYesterday(!!yEntry && !yEntry.clock_out);

      const resToday = await grabDriverTimeEntries(profile.id, today);
      if (resToday?.data?.clock_in && resToday?.data?.clock_out) {
        setClosedTimeSheet(true);
        setClockedOut(true);
      }

      const isClockedIn = resToday.data?.id && resToday.data?.clock_in;
      if (!isClockedIn) {
        setTimeEntry([]);
        setClockedIn(false);
        setRoute(null);
        setStops([]);
        setRouteAttempted(false);
        return null;
      } else {
        setTimeEntry(resToday.data || []);
        setClockedIn(true);
        return resToday.data;
      }
    } catch {
      setTimeEntry([]);
      setClockedIn(false);
      setRoute(null);
      setStops([]);
      setRouteAttempted(false);
    } finally {
      setLoading(false);
    }
  };

  const validateWtihin1Mile = async () => {
    if (!profile?.id) return;
    const res = await grabRouteProfileAndDate(profile.id ?? 0, today);
    const r: RouteRecord | null = res?.success ? res.data ?? null : null;
    setRoute(r);
    const routeStatus = r?.status;
    const fix = await getOneFix();
    if (fix.ok) {
      const within = isWithinOneMile(
        { latitude: fix.coords.latitude, longitude: fix.coords.longitude },
        {
          latitude: r?.start_latitude ?? 0,
          longitude: r?.start_longitude ?? 0,
        },
      );
      if (
        within.within &&
        routeStatus === 'dispatched' &&
        r?.start_base &&
        !clockedIn
      ) {
        setStartWithin1Mile(false);
      } else {
        setStartWithin1Mile(true);
      }
    }
  };

  const run = async () => {
    try {
      const res = await grabRouteProfileAndDate(profile.id, today);
      const r: RouteRecord | null = res?.success ? res.data ?? null : null;
      setRoute(r);
      setAllowedBreaks(!!r?.allowed_breaks);
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
    void grabAllRouteBreaks();
  }, [route?.id]);

  const grabAllRouteBreaks = async () => {
    const res = await grabRouteBreaks(route?.id ?? 0);
    const list = Array.isArray(res?.data) ? res.data : [];
    setBreaks(list);

    const hasOpenBreak = list.some((b: any) => {
      const start =
        b?.start ?? b?.started ?? b?.start_time ?? b?.begin ?? b?.clock_in;
      const end =
        b?.end ?? b?.ended ?? b?.end_time ?? b?.finish ?? b?.clock_out;
      return !!start && !end;
    });
    setBreakOn(hasOpenBreak);
    setCurrentBreak(
      list.find((b: any) => {
        const start =
          b?.start ?? b?.started ?? b?.start_time ?? b?.begin ?? b?.clock_in;
        const end =
          b?.end ?? b?.ended ?? b?.end_time ?? b?.finish ?? b?.clock_out;
        return !!start && !end;
      }) || null,
    );
  };

  const stopBreak = async () => {
    if (!route?.id || !profile?.id || !business?.id) return;
    if (breakOn) {
      const nowIso = new Date().toISOString();
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
      await createNotification(
        'Break Ended',
        `${profile?.first_name} ${profile?.last_name?.[0]}. has ended a break`,
      );
      void grabAllRouteBreaks();
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
    const res = await updateTimeEntry((yesterdayTimeEntry as any)?.id, {
      clock_out: new Date().toISOString(),
      status: 'closed',
    });
    setYesterdayTimeEntry(res.data);
    if (res.success) {
      setNeedsCloseFromYesterday(res.data.clock_out === null);
    }
  };

  const minutesBetween = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso || !endIso) return 0;
    const a = new Date(startIso).getTime();
    const b = new Date(endIso).getTime();
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, Math.round((b - a) / 60000));
  };

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
      if (
        typeof br.minutes_lapsed === 'number' &&
        isFinite(br.minutes_lapsed) &&
        br.minutes_lapsed >= 0
      ) {
        return sum + Math.round(br.minutes_lapsed);
      }
      const end = br.ended || nowIso;
      return sum + minutesBetween(br.started, end);
    }, 0);
  };

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
    };
  };

  /* ─────────────── live feed lifecycle (NEW) ─────────────── */

  const liveCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!profile?.id || !business?.id) return;

    if (clockedIn) {
      // ensure previous timers/listeners are cleared first
      stopLiveFeed();
      liveCleanupRef.current?.();

      const cleanup = startLiveFeed({
        profileId: profile.id,
        driverId: (profile as any).employee_id ?? profile.id,
        businessId: business.id,
        routeId: route?.id ?? null,
        service_date: today,
      });

      liveCleanupRef.current = cleanup;
    } else {
      // not clocked in: stop everything
      stopLiveFeed();
      liveCleanupRef.current?.();
      liveCleanupRef.current = null;
    }

    // on unmount: hard stop
    return () => {
      stopLiveFeed();
      liveCleanupRef.current?.();
      liveCleanupRef.current = null;
    };
  }, [clockedIn, profile?.id, business?.id, route?.id]);

  /* ─────────────── actions ─────────────── */

  const handleClockOut = async () => {
    try {
      const current = timeEntry[0];
      if (!current?.id || !current?.clock_in) {
        Alert.alert(
          'No open timesheet',
          'Could not find an active time entry to close.',
        );
        return;
      }
      const payload = buildClockOutPayload({
        clockInIso: current.clock_in,
        breaksList: breaks || [],
      });
      const res = await updateTimeEntry(current.id, payload);
      if (!res?.success) {
        Alert.alert('Clock out failed', res?.message || 'Please try again.');
        return;
      }
      setClockedOut(true);
      await createNotification(
        'Clocked Out',
        `${profile?.first_name} ${profile?.last_name?.[0]}. has clocked out`,
      );
      // stop live feed immediately
      stopLiveFeed();
      liveCleanupRef.current?.();
      liveCleanupRef.current = null;

      checkTimesheet();
      Alert.alert('Clocked out', 'Your time has been recorded.');
    } catch (e: any) {
      Alert.alert('Clock out failed', e?.message || 'Please try again.');
    }
  };

  const handleClockIn = async () => {
    try {
      setLoading(true);

      // enforce location policy before clock in
      const okToClockIn = await (async () => {
        const lvl = await tryUpgradeToAlways();
        if (isAlwaysLike(lvl)) return true;
        setModalMode(lvl.authorized ? 'need_always' : 'need_permission');
        setShowLocModal(true);
        return false;
      })();

      if (!okToClockIn) {
        setLoading(false);
        return;
      }

      // close yesterday if needed
      const resY = await grabDriverLastEntryPriorToday(profile?.id ?? 0, today);
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

      // create today entry
      const res = await createTimeEntry({
        business_id: business.id,
        profile_id: profile.id,
        selected_date: today,
        clock_in: new Date().toISOString(),
        clock_out: null,
        status: 'open',
        duration_minutes: null,
        source: 'app',
        notes: 'Clocked in from driver app',
      });

      if (route?.id) {
        const resRoute = await updateRouter(route?.id ?? 0, {
          status: 'in_progress',
        });

        setStartWithin1Mile(false);

        if (resRoute?.success) {
          setRoute(resRoute.data);
        }
      }

      if (res?.success) {
        setTimeEntry(res.data || []);
        setClockedIn(true); // <- live feed starts via effect
        await createNotification(
          'New Clock In',
          `${profile?.first_name} ${profile?.last_name?.[0]}. has clocked in`,
        );
        run(); // fetch route/stops
      } else {
        Alert.alert('Clock in failed', res?.message || 'Try again.');
      }
    } catch (e: any) {
      Alert.alert('Clock in failed', e?.message || 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const createNotification = async (title: string, body: string) => {
    // NOTE: The original code used 'invite.business_id', but the context was 'business.id'.
    // I'm using 'invite.business_id' as provided in your prompt, but verify this is correct.
    const admin = await getBusinessAdmin(business?.id ?? 0);

    if (admin.data.length > 0) {
      // 1. FILTER: First, filter the admin data to only include those with a valid apns_token.
      const adminsWithToken = admin.data.filter((a: any) => {
        const token = a?.profile?.device?.[0]?.apns_token;
        // A concise check for a non-empty string: it's not null/undefined AND its length > 0
        return typeof token === 'string' && token.length > 0;
      });

      // 2. MAP: Then, create an array of Promises only for the filtered admins.
      const sendPromises = adminsWithToken.map(async (a: any) => {
        const token = a.profile.device[0].apns_token;

        const payload = {
          title: title,
          body: body,
          data: 'This is notification data',
          token: token,
          token_type: Platform.OS,
          sendAt: 1000,
        };

        const res = await sendNotification(payload);
        return res?.success; // Return the success status of the send attempt
      });

      // 3. AWAIT: Wait for all successful promises to complete.
      // If 'adminsWithToken' is empty, 'sendPromises' is empty, and Promise.all resolves immediately.
      const results = await Promise.all(sendPromises);

      // Return true if at least one notification attempt was successful.
      return results.some(success => success);
    }
    return true;
  };

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

  const cancelAutoStart = () => {
    clearAutoTimer();
    setAutoStart(null);
  };

  const doAutoStartStop = async (stop: Stop, r: RouteRecord) => {
    try {
      await updateStopStatus(stop.id, { status: 'en_route' });
      await updateRouter(r.id, { status: 'in_progress' });
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
      if (stop.status === 'scheduled') {
        await updateStopStatus(stop.id, { status: 'en_route' });
        markEnrouteLocal(stop.id);
        navigation.navigate(
          'Stop' as never,
          { stop: { ...stop, status: 'en_route' } } as never,
        );
      }
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
    navigation.navigate('Stop' as never, { stop: r } as never);
  };

  const checkForStopAndAutoStart = async (list: Stop[], r: RouteRecord) => {
    if (!r || !Array.isArray(list)) return;

    const isStopDone = (s: Stop) =>
      String(s.status).toLowerCase() === 'completed' ||
      String(s.status).toLowerCase() === 'closed';

    const sorted = sortStopsBySequence(list);

    if (sorted.length === 0) {
      setCurrentStop(null);
      setNextStop(null);
      setRemainingCount(0);
      setAllDoneToday(false);
      return;
    }

    const remaining = sorted.filter(s => !isStopDone(s));
    setRemainingCount(remaining.length);

    if (remaining.length === 0) {
      setCurrentStop(null);
      setNextStop(null);
      setAllDoneToday(true);
      clearAutoTimer();
      setAutoStart(null);
      return;
    }

    setAllDoneToday(false);

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

    const next =
      remaining.find(s => String(s.status).toLowerCase() === 'scheduled') ??
      remaining[0];

    if (!next) {
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

  useEffect(() => {
    const open = stops.filter(s => s.status !== 'completed');
    setCurrentStop(open[0] ?? null);
    setNextStop(open[1] ?? null);
    setRemainingCount(open.length);
  }, [stops]);

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
          {/* <TouchableOpacity
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
          </TouchableOpacity> */}
        </View>
      </View>

      {/* Time/Break strip */}
      {needsCloseFromYesterday ? (
        <>
          <View
            style={[
              tw`mx-4 mb-3 px-3 py-2 rounded-2xl flex-row items-center justify-between`,
              { backgroundColor: colors.card },
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
              text="You have a previously open timesheet that has not been closed. You must close the previous timesheet in order to click in today."
              colors={colors}
            />
          </View>
        </>
      ) : startWithin1Mile ? (
        <View />
      ) : (
        <View
          style={[
            tw`mx-4 mb-3 px-3 py-2 rounded-2xl flex-row items-center justify-between`,
            { backgroundColor: colors.card },
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
                : 'Start your day'}
            </Text>
          </View>
          {clockedOut ? null : (
            <>
              {!allDoneToday ? (
                <>
                  {clockedIn ? (
                    <>
                      {!route ? (
                        <TinyButton
                          label="Clock Out"
                          onPress={handleClockOut}
                          colors={colors}
                          LeftIcon={Play}
                        />
                      ) : (
                        <TinyButton
                          label={breakOn ? 'End Break' : 'Start Break'}
                          onPress={
                            breakOn
                              ? stopBreak
                              : async () => {
                                  if (
                                    !route?.id ||
                                    !profile?.id ||
                                    !business?.id
                                  )
                                    return;
                                  if (
                                    (breaks?.length ?? 0) <
                                    (route?.allowed_breaks ?? 0)
                                  ) {
                                    await newRouteBreak({
                                      route_id: route?.id ?? 0,
                                      profile_id: profile?.id ?? 0,
                                      business_id: business?.id ?? 0,
                                      started: new Date().toISOString(),
                                    });
                                    await createNotification(
                                      'Break Started',
                                      `${profile?.first_name} ${profile?.last_name?.[0]}. has started a break`,
                                    );
                                    void grabAllRouteBreaks();
                                  } else {
                                    Alert.alert(
                                      'Limit Reached',
                                      'You have reached the maximum number of breaks for this route.',
                                    );
                                  }
                                }
                          }
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
            </>
          )}
        </View>
      )}

      {/* Content */}
      {startWithin1Mile ? (
        <View style={tw`px-4`}>
          <StartGateMapCard
            token={MAPBOX_TOKEN}
            start={{
              latitude: route?.start_latitude ?? 0,
              longitude: route?.start_longitude ?? 0,
            }}
            colors={colors}
            pollMs={5000} // 5 seconds
            onResolved={notWithin => {
              setStartWithin1Mile(notWithin);
            }}
            forceClockIn={handleClockIn}
          />
        </View>
      ) : !clockedIn ? (
        <View />
      ) : !routeAttempted ? (
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
                text="You have clocked out. Today’s route is complete. If you clocked out by mistake, contact your manager to re-open your timesheet."
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
                      backgroundColor: colors.card,
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

                  <View
                    style={[
                      tw`h-2 rounded-full mt-3`,
                      { backgroundColor: colors.border },
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
              <TouchableOpacity onPress={() => void run()}>
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
                  { backgroundColor: colors.card },
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

      {/* Location Requirement Modal */}
      {showLocModal && (
        <View
          style={[
            tw`absolute inset-0 items-center justify-center px-6`,
            { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 },
          ]}
        >
          <View
            style={[
              tw`w-full rounded-2xl p-4`,
              { backgroundColor: colors.card || '#0b1220' },
            ]}
          >
            <Text style={[tw`text-lg font-bold`, { color: colors.text }]}>
              {modalMode === 'need_permission'
                ? 'Enable Location Access'
                : 'Switch to “Always” Location'}
            </Text>

            <Text style={[tw`text-xs mt-2`, { color: colors.muted }]}>
              We use your location for accurate directions and live tracking.
              {'\n'}
              <Text style={{ fontWeight: '600', color: colors.text }}>
                Your location is only shared while you are clocked in.
              </Text>{' '}
              When you clock out, sharing stops.
            </Text>

            <TouchableOpacity
              onPress={async () => {
                await openAppSettings();
                // When app returns, onReturnFromSettings() will trigger recheckLocationGate()
              }}
              style={[
                tw`w-full mt-3 py-2 rounded-xl items-center`,
                { backgroundColor: colors.brand?.primary || '#2563eb' },
              ]}
            >
              <Text style={tw`text-white font-semibold text-sm`}>
                {modalMode === 'need_permission'
                  ? 'Open Settings to Enable Location'
                  : 'Open Settings to Allow “Always”'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowLocModal(false)}
              style={tw`self-end mt-3`}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
      style={[
        tw`flex-1 px-3 py-3 rounded-xl`,
        { backgroundColor: colors.border },
      ]}
    >
      <Text style={[tw`text-2xs`, { color: colors.textSecondary }]}>
        {label}
      </Text>
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
        tw`px-3 py-1.5 rounded-full flex-row items-center`,
        { backgroundColor: colors.brand.primary },
      ]}
    >
      {LeftIcon ? (
        <LeftIcon width={14} height={14} color="#fff" strokeWidth={1.5} />
      ) : null}
      <Text style={[tw`text-2xs font-semibold ml-1 text-white`]}>{label}</Text>
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
      style={[tw`px-3 pb-2 rounded-xl`, { backgroundColor: colors.card }]}
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
              {isCurrentRoute && isCurrentStop ? (
                <ActionPill
                  label="Head to stop"
                  LeftIcon={NavIcon}
                  onPress={onHeadToStop}
                  colors={colors}
                />
              ) : (
                <>
                  {isCurrentRoute &&
                  item.status === 'arrived' &&
                  isCurrentStop ? (
                    <ActionPill
                      label="Continue to stop"
                      LeftIcon={NavIcon}
                      onPress={() => onGoToRoute(item as any)}
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
              {/* {item.contact_phone || item.phone ? (
                <ActionPill
                  label="Call"
                  LeftIcon={Phone}
                  onPress={onCall}
                  colors={colors}
                />
              ) : null} */}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
