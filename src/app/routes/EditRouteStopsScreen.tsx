// src/app/routes/RouteDraftScreen.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  MapPin,
  User,
  X as CloseIcon,
  Phone,
  Edit2,
} from 'react-native-feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import Field from '../../shared/components/inputs/Field';
import FieldSuggestions from '../../shared/components/inputs/FieldSuggestions';
import { api } from '../../shared/lib/api';
import {
  getRouteById,
  publishRouteWithStops,
  reassignDriver,
} from '../../shared/lib/RouteHelpers';
import {
  createStop,
  deleteStop,
  updateStopSequence,
} from '../../shared/lib/StopsHelpers';
import { CreateInbox } from '../../shared/lib/inboxHelpers';
import { useSession } from '../../state/useSession';

// Driver helpers
import { getDrivers } from '../../shared/lib/DriversHelpers';
import DriverPickerModal from '../../shared/components/modals/DriverPickerModal';

// Optimizer call (only import the API call; we define ordering locally)
import { createOptimizedRoute } from '../../shared/lib/optimications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessAdmin } from '../../shared/lib/BusinessHelpers';
import { sendNotification } from '../../shared/lib/notifications';

/* ───────────────────────── Utils ───────────────────────── */

const convertToYYYYMMDD = (date: string) => {
  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
};

const selectedDate = convertToYYYYMMDD(new Date().toLocaleDateString());

function toHHmm(d: Date) {
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

function formatHMAmPm(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    let h = d.getHours();
    const m = `${d.getMinutes()}`.padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
}

/* ───────────────────────── Types ───────────────────────── */

type RouteParams = {
  routeId: number;
  payload: {
    business_id: number | null;
    driver_id: number | null; // profile id
    employee_id: number | null; // employee id
    name: string;
    service_date: string; // YYYY-MM-DD
    status: 'draft';
    planned_start_at: string; // YYYY-MM-DDTHH:mm:ss
    start_longitude: number;
    start_latitude: number;
    tags: string[];
    notes: string | null;
  };
};

type StopStatus =
  | 'planned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'canceled'
  | 'cancelled'
  | string;

type Stop = {
  id: number;
  route_id: number;
  customer_name: string | null;
  business_name?: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  planned_service_minutes: number | null;
  window_start: string | null; // HH:mm
  window_end: string | null; // HH:mm
  notes: string | null;
  sequence: number;
  status?: StopStatus;
};

const metersToMiles1dp = (m?: number | null) =>
  typeof m === 'number' && isFinite(m)
    ? Math.round((m / 1609.344) * 10) / 10
    : null;

/* ───────────────────────── Screen ───────────────────────── */

export default function EditRouteStopsScreen() {
  const { colors } = useTheme();
  const { business, profile } = useSession();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { routeId, payload } = params as RouteParams;
  console.log('payload', payload);

  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [route, setRoute] = useState<any>(null);

  const [headerTitle, setHeaderTitle] = useState('');

  // Driver reassignment state
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  const [fullyOptimized, setFullyOptimized] = useState(false);

  /* ---------- Local helper: apply optimized order ---------- */

  type ApplyOptimizedOrderArgs = {
    optimized: any;
    currentStops: Array<{ id: number; sequence?: number }>;
    fetchStops?: () => Promise<void>;
  };

  const applyOptimizedOrderLocal = async ({
    optimized,
    currentStops,
    fetchStops,
  }: ApplyOptimizedOrderArgs): Promise<void> => {
    // 1) Normalize optimizer payload
    const data = optimized?.data?.overall ? optimized.data : optimized;
    const overall = data?.overall ?? {};
    let orderedIds: number[] = overall.ordered_stop_ids ?? [];

    // Fallback 1: build from stop_sequences
    if (!orderedIds.length && Array.isArray(overall.stop_sequences)) {
      orderedIds = overall.stop_sequences
        .slice()
        .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((s: any) => s.stop_id);
    }

    // Fallback 2: reconstruct from legs (origin → ... → destination)
    if (
      !orderedIds.length &&
      Array.isArray(data?.segments) &&
      data.segments.length > 0
    ) {
      const seg = data.segments[0];
      const legs = Array.isArray(seg.legs) ? seg.legs : [];
      if (legs.length > 0) {
        const seen = new Set<number>();
        const pushId = (id: any) => {
          const n = typeof id === 'number' ? id : Number(id);
          if (Number.isFinite(n) && !seen.has(n)) {
            seen.add(n);
            orderedIds.push(n);
          }
        };
        legs.forEach((lg: any, idx: number) => {
          if (idx === 0) pushId(lg.from_id);
          pushId(lg.to_id);
        });
        const stopIdSet = new Set(currentStops.map(s => s.id));
        orderedIds = orderedIds.filter(id => stopIdSet.has(id));
      }
    }

    // Fallback 3: keep current order
    if (!orderedIds.length) {
      orderedIds = currentStops
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map(s => s.id);
    }

    // Include leftovers not seen in optimizer output (defensive)
    const idSet = new Set(orderedIds);
    const leftovers = currentStops.filter(s => !idSet.has(s.id)).map(s => s.id);
    const finalOrderIds = [...orderedIds, ...leftovers];

    // 2) Build expectedDistanceMap from legs: distance for each leg's "to_id"
    // Works for single or multi segments. If duplicates exist, last write wins.
    const expectedDistanceMap = new Map<number, number | null>();
    if (Array.isArray(data?.segments)) {
      for (const seg of data.segments) {
        const legs = Array.isArray(seg?.legs) ? seg.legs : [];
        for (const lg of legs) {
          const toId = Number(lg?.to_id);
          if (Number.isFinite(toId)) {
            const miles1dp = metersToMiles1dp(lg?.distance_meters);
            expectedDistanceMap.set(toId, miles1dp);
          }
        }
      }
    }

    // 3) Update local state immediately (snappy UX)
    setStops(prev => {
      const byId = new Map(prev.map(s => [s.id, s]));
      return finalOrderIds.map((id, i) => {
        const s = byId.get(id)!;
        // Local echo of expected_distance if you want it reflected in UI right away:
        const expected_distance = expectedDistanceMap.has(id)
          ? expectedDistanceMap.get(id)
          : s.expected_distance ?? null;
        return { ...s, sequence: i + 1, expected_distance };
      });
    });

    // 4) Persist sequentially (one-by-one) with expected_distance
    const failures: Array<{ stopId: number; sequence: number; error: any }> =
      [];
    for (let i = 0; i < finalOrderIds.length; i++) {
      const stopId = finalOrderIds[i];
      const sequence = i + 1;
      const expected_distance = expectedDistanceMap.has(stopId)
        ? expectedDistanceMap.get(stopId)
        : null;

      try {
        // IMPORTANT: updateStopSequence must accept expected_distance on the payload
        await updateStopSequence(stopId, { sequence, expected_distance });
      } catch (error) {
        console.warn('updateStopSequence failed', { stopId, sequence, error });
        failures.push({ stopId, sequence, error });
      }
    }

    if (failures.length) {
      try {
        await fetchStops?.();
      } catch {}
      Alert.alert(
        'Order saved with issues',
        `Updated ${finalOrderIds.length - failures.length} stops, ${
          failures.length
        } failed.`,
      );
    }
  };

  // Normal path: we have an order; update local state first

  /* ---------- Effects ---------- */

  useEffect(() => {
    const d = new Date(payload.service_date);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    setHeaderTitle(label);
  }, [payload]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
      fetchStops();
    }, []),
  );

  useLayoutEffect(() => {
    initialLoad();
    fetchStops();
  }, []);

  const initialLoad = async () => {
    const stored = await AsyncStorage.getItem('fullyOptimized');
    setFullyOptimized(stored === 'true');
  };

  useLayoutEffect(() => {
    if (!business?.id) return;
    (async () => {
      try {
        const res = await getDrivers(business.id);
        const list = (res?.data ?? []).filter(
          (e: any) => e.is_driver !== false,
        );
        setAllDrivers(list);

        const currentEmpId = payload.employee_id ?? route?.employee_id ?? null;
        const cur = list.find((d: any) => d.id === currentEmpId) ?? null;
        console.log('cur', cur);
        setSelectedDriver(cur);
      } catch {}
    })();
  }, [business?.id, route?.employee_id, payload.employee_id]);

  /* ---------- Data fetch ---------- */

  const fetchStops = async () => {
    setLoading(true);
    try {
      const res = await getRouteById(routeId);
      setRoute(res.data);
      setStops(
        (res.data.stops || [])
          .slice()
          .sort((a: Stop, b: Stop) => a.sequence - b.sequence),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load stops');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Reordering utilities ---------- */

  const MOVABLE = new Set<StopStatus>(['planned', 'scheduled']);
  const canMoveStop = (s?: Stop) => !!s && (!s.status || MOVABLE.has(s.status));

  const openCreate = () => {
    nav.navigate('AddStopScreen1', { routeId, stopsCount: stops.length });
  };
  const openEdit = (s: Stop) => {
    nav.navigate('StopSummaryEditScreen', { stop: s });
  };

  const confirmDelete = (s: Stop) => {
    Alert.alert('Remove stop?', `Delete "${s.customer_name ?? 'Stop'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStop(s.id);
            fetchStops();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Delete failed');
          }
        },
      },
    ]);
  };

  const swapStops = async (indexA: number, indexB: number) => {
    if (
      indexA < 0 ||
      indexB < 0 ||
      indexA >= stops.length ||
      indexB >= stops.length
    )
      return;
    const a = stops[indexA];
    const b = stops[indexB];

    if (!canMoveStop(a) || !canMoveStop(b)) return;

    const aSeq = a.sequence;
    const bSeq = b.sequence;

    setStops(prev => {
      const next = [...prev];
      next[indexA] = { ...a, sequence: bSeq };
      next[indexB] = { ...b, sequence: aSeq };
      return next.sort((x, y) => x.sequence - y.sequence);
    });

    try {
      await Promise.all([
        updateStopSequence(a.id, { sequence: bSeq }),
        updateStopSequence(b.id, { sequence: aSeq }),
      ]);
    } catch (e: any) {
      setStops(prev => {
        const next = [...prev];
        const ai = next.findIndex(s => s.id === a.id);
        const bi = next.findIndex(s => s.id === b.id);
        if (ai >= 0) next[ai] = { ...next[ai], sequence: aSeq };
        if (bi >= 0) next[bi] = { ...next[bi], sequence: bSeq };
        return next.sort((x, y) => x.sequence - y.sequence);
      });
      Alert.alert(
        'Reorder failed',
        e?.message || 'Unable to update stop order.',
      );
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    swapStops(index, index - 1);
  };
  const moveDown = (index: number) => {
    if (index === stops.length - 1) return;
    swapStops(index, index + 1);
  };

  /* ---------- Confirm (create end base if needed) then optimize ---------- */

  const confirmRoute = async () => {
    if (!route) {
      Alert.alert('No route', 'Load a route first.');
      return;
    }

    // If end_base is true, create the return-to-base stop first, then optimize.
    if (route.end_base) {
      const payloadToCreate = {
        route_id: route.id,
        business_id: business.id,
        stop_type: 'baae', // marker for your backend (was 'baae' earlier)
        depot_role: 'end', // optional semantic
        customer_id: null,
        vendor_id: null,
        address_line1: business.address_line1 ?? '',
        address_line2: business.address_line2 ?? null,
        city: business.city ?? '',
        region: business.region ?? '',
        postal_code: business.postal_code ?? null,
        country_code: business.country_code ?? 'US',
        latitude: business.latitude ?? null,
        longitude: business.longitude ?? null,
        status: 'scheduled',
        contact_name: business.name ?? 'Base',
        contact_phone: business.phone ?? '',
        contact_email: business.email ?? '',
        business_name: 'Base',
        sequence: stops.length + 1,
        is_lunch: false,
        expected_duration: 60,
        auto_trigger: false,
      };

      const res = await createStop(payloadToCreate);
      if (res.success) {
        const newStops = [...stops, res.data];
        setStops(newStops);
        if (route.optimize) {
          await optimizeFullRoute(newStops);
        }
      } else {
        Alert.alert('Error', res.error?.message ?? 'Failed to create stop.');
      }
    } else {
      // No end base – optimize immediately using current stops
      if (route.optimize) {
        await optimizeFullRoute(stops);
      } else {
        // If not optimizing, just publish
        await onPublish();
      }
    }
  };

  /* ---------- Optimizer ---------- */

  const optimizeFullRoute = async (currentStops: Stop[]) => {
    try {
      if (!route) {
        Alert.alert('No route', 'Load a route first.');
        return;
      }
      if (!Array.isArray(currentStops) || currentStops.length === 0) {
        Alert.alert('No stops', 'Add at least one stop to optimize.');
        return;
      }

      const asNum = (v: any) => (typeof v === 'number' ? v : Number(v));

      // Determine fixed endpoints based on flags and currentStops content:
      // - start_base true: the first stop is the base (fixed origin)
      // - end_base true:   the last stop is the base (fixed destination)
      let origin: {
        latitude: number;
        longitude: number;
        stop_id?: number;
      } | null = null;
      let dest: {
        latitude: number;
        longitude: number;
        stop_id?: number;
      } | null = null;

      if (route.start_base) {
        const first = currentStops[0];
        if (
          !Number.isFinite(asNum(first?.latitude)) ||
          !Number.isFinite(asNum(first?.longitude))
        ) {
          Alert.alert(
            'Missing coordinates',
            `First stop (#${first?.id}) has no latitude/longitude.`,
          );
          return;
        }
        origin = {
          latitude: asNum(first.latitude)!,
          longitude: asNum(first.longitude)!,
          stop_id: first.id,
        };
      }

      if (route.end_base) {
        const last = currentStops[currentStops.length - 1];
        if (
          !Number.isFinite(asNum(last?.latitude)) ||
          !Number.isFinite(asNum(last?.longitude))
        ) {
          Alert.alert(
            'Missing coordinates',
            `Last stop (#${last?.id}) has no latitude/longitude.`,
          );
        }
        dest = {
          latitude: asNum(last.latitude)!,
          longitude: asNum(last.longitude)!,
          stop_id: last.id,
        };
      }

      // Intermediates: exclude the fixed endpoints if they exist
      let middle = [...currentStops];
      if (route.start_base && middle.length > 0) {
        middle = middle.slice(1); // remove first (origin)
      }
      if (route.end_base && middle.length > 0) {
        middle = middle.slice(0, middle.length - 1); // remove last (destination)
      }

      const stopsPayload = middle.map(s => {
        const lat = asNum(s.latitude);
        const lng = asNum(s.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error(`Stop #${s.id} is missing latitude/longitude.`);
        }
        return {
          id: s.id,
          latitude: lat,
          longitude: lng,
          service_minutes: Number(s.planned_service_minutes) || 10,
        };
      });

      const payloadToOptimize = {
        route_id: route.id,
        units: 'IMPERIAL',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        origin,
        destination: dest,
        stops: stopsPayload,
      };

      console.log('optimizeFullRoute payload:', payloadToOptimize);
      const res = await createOptimizedRoute(payloadToOptimize);
      console.log(
        'optimizeFullRoute result:',
        JSON.stringify(res.data, null, 2),
      );

      if (!res?.success) {
        Alert.alert(
          'Optimization failed',
          res?.message || 'Server returned an error.',
        );
        return;
      }

      await applyOptimizedOrderLocal({
        optimized: res.data, // or res if that's how your helper returns it
        currentStops, // the array you built and sent to optimizer
      });

      setFullyOptimized(true);
      await AsyncStorage.setItem('fullyOptimized', 'true');
      Alert.alert(
        'Optimized!',
        'Route order and metrics received. Review before publishing.',
      );
    } catch (e: any) {
      console.error('optimizeFullRoute error', e);
      Alert.alert('Error', e?.message || 'Failed to optimize route.');
    }
  };

  const notifyRouteDispatched = async ({
    businessId,
    routeId,
    routeName,
    serviceDateISO,
    plannedStartISO,
    dispatcherProfileId,
  }: {
    businessId: number;
    routeId: number;
    routeName: string;
    serviceDateISO: string;
    plannedStartISO: string;
    dispatcherProfileId: number;
  }) => {
    const base = {
      businessId,
      type: 'route_dispatched',
      severity: 'info',
      actor: 'owner_app',
      actor_id: dispatcherProfileId,
      actionable: true,
      action_label: 'Open route',
      action_route: 'RouteDetailScreen',
      action_params: { routeId },
      metadata: { routeId, routeName, serviceDateISO, plannedStartISO },
    };

    await CreateInbox({
      ...base,
      title: 'Route dispatched',
      body: `“${routeName}” (${serviceDateISO}) is now dispatched.`,
      profile_id: dispatcherProfileId,
      dedupe_key: `route.dispatched:${routeId}:${dispatcherProfileId}`,
    });
  };

  const onPublish = async () => {
    if (stops.length === 0) {
      Alert.alert(
        'Add at least 1 stop',
        'You need at least one stop to publish.',
      );
      return;
    }
    setPublishing(true);
    console.log('publish date', selectedDate);
    try {
      const resp = await publishRouteWithStops(routeId, {
        status: 'dispatched',
        service_date: selectedDate,
      });
      await createNotification(
        'Route Updates',
        `${payload.name} has been updated and is ready to be dispatched.`,
      );
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to publish route');
    } finally {
      setPublishing(false);
    }
  };

  const createNotification = async (title: string, body: string) => {
    console.log(
      'selectedDriver',
      selectedDriver?.Profile?.device[0]?.apns_token,
    );
    if (selectedDriver?.Profile?.device[0]?.apns_token) {
      const notPayload = {
        title: title,
        body: body,
        data: 'This is notification data',
        token: selectedDriver?.Profile?.device[0]?.apns_token, // Fixed potential typo: 'prfile' -> 'profile'
        token_type: Platform.OS,
        sendAt: 1000,
      };
      const res = await sendNotification(notPayload);
      return res?.success; // Return the success status of the send attempt
    }
  };

  /* ---------- Driver reassignment ---------- */

  const handleReassignDriver = async (emp: any) => {
    try {
      const body = {
        employee_id: emp.id,
        driver_id: emp?.Profile?.id ?? null, // profile id
        service_date: new Date().toISOString().slice(0, 10),
      };

      const res = await reassignDriver(routeId, body);
      if (res.error)
        throw new Error('Failed to reassign driver: ' + res.error.message);

      setSelectedDriver(emp);

      try {
        await CreateInbox({
          businessId: payload.business_id!,
          type: 'driver_reassigned',
          severity: 'info',
          title: 'Driver reassigned',
          body:
            `“${payload.name}” is now assigned to ` +
            ([emp?.Profile?.first_name, emp?.Profile?.last_name]
              .filter(Boolean)
              .join(' ') || `#${emp.id}`) +
            '.',
          actor: 'owner_app',
          actor_id: profile?.id ?? null,
          actionable: true,
          action_label: 'Open route',
          action_route: 'RouteDraftScreen',
          action_params: { routeId },
          driver_employee_id: emp.id,
          driver_profile_id: emp?.Profile?.id ?? null,
          dedupe_key: `route.reassigned:${routeId}:${emp.id}`,
          profile_id: profile?.id ?? null,
        });
      } catch (e) {
        console.log('CreateInbox route.reassigned failed', e);
      }
      fetchStops();
      Alert.alert('Driver updated', 'Route assigned to the selected driver.');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Could not reassign driver.');
    }
  };

  const plannedStartHM = formatHMAmPm(payload.planned_start_at);

  /* ---------- Render ---------- */

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
    >
      {/* Top bar */}
      <View style={tw`px-2 pt-4 pb-3 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            Edit Route Stops
          </Text>
        </View>
      </View>

      <FlatList
        data={stops}
        keyExtractor={item => `${item.id}`}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={tw`px-4`}>
            {/* Summary */}
            <View
              style={[
                tw`rounded-2xl p-3 mb-3`,
                { backgroundColor: colors.border },
              ]}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <Text
                  style={[
                    tw`text-lg font-semibold mb-1`,
                    { color: colors.text },
                  ]}
                >
                  {payload.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log('route', JSON.stringify(route, null, 2));
                    nav.navigate('EditRouteScreen', { route });
                  }}
                  style={[
                    tw`ml-2 rounded-lg p-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <Edit2 width={14} height={14} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={tw`flex-row items-center mb-1`}>
                <Calendar width={14} height={14} color={colors.text} />
                <Text style={[tw`ml-2 text-sm`, { color: colors.text }]}>
                  {headerTitle}
                </Text>
              </View>

              <View style={tw`flex-row items-center mb-1`}>
                <Clock width={14} height={14} color={colors.text} />
                <Text style={[tw`ml-2 text-sm`, { color: colors.text }]}>
                  Planned start: {plannedStartHM || '—'}
                </Text>
              </View>

              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center`}>
                  <User width={14} height={14} color={colors.text} />
                  <Text style={[tw`ml-2 text-sm`, { color: colors.text }]}>
                    Driver: #{route?.employee_id ?? payload.employee_id ?? '—'}
                    {' / '}
                    {(route?.profile?.first_name ?? '') +
                      ' ' +
                      (route?.profile?.last_name ?? '')}
                  </Text>
                </View>
              </View>

              {!!payload.tags?.length && (
                <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
                  Tags: {payload.tags.join(', ')}
                </Text>
              )}
              {!!payload.notes && (
                <Text style={[tw`mt-1 text-xs`, { color: colors.muted }]}>
                  Notes: {payload.notes}
                </Text>
              )}
            </View>

            {/* Controls */}
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <Text
                style={[tw`text-base font-semibold`, { color: colors.text }]}
              >
                Stops ({stops.length})
              </Text>
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  onPress={openCreate}
                  style={[
                    tw`px-3 py-2 rounded-xl flex-row items-center`,
                    { backgroundColor: colors.brand?.primary || '#2563eb' },
                  ]}
                >
                  <Plus width={16} height={16} color="#fff" />
                  <Text style={tw`text-white ml-1`}>Add Stop</Text>
                </TouchableOpacity>
              </View>
            </View>

            {stops.length === 0 && (
              <View
                style={[
                  tw`rounded-2xl p-4 mb-3`,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text style={[tw`text-sm`, { color: colors.muted }]}>
                  No stops yet. Tap “Add Stop” to get started.
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const upDisabled =
            index === 0 || !canMoveStop(item) || !canMoveStop(stops[index - 1]);
          const downDisabled =
            index === stops.length - 1 ||
            !canMoveStop(item) ||
            !canMoveStop(stops[index + 1]);

          return (
            <View style={[tw`px-4`]}>
              <View
                style={[
                  tw`rounded-2xl mb-3 p-3`,
                  { backgroundColor: colors.border },
                ]}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <Text
                    style={[
                      tw`text-base font-semibold`,
                      { color: colors.text },
                    ]}
                  >
                    {index + 1}.{' '}
                    {item.customer_name ||
                      item.business_name ||
                      'Unknown Business'}
                  </Text>
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      onPress={() => openEdit(item)}
                      style={tw`mr-2`}
                    >
                      <Edit3 width={18} height={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(item)}>
                      <Trash2 width={18} height={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {!!item.address_line1 && (
                  <View style={tw`flex-row items-center mt-1`}>
                    <MapPin width={14} height={14} color={colors.muted} />
                    <Text
                      style={[tw`ml-2 text-sm`, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.address_line1}, {item.city}, {item.region},{' '}
                      {item.postal_code}
                    </Text>
                  </View>
                )}

                <View style={tw`flex-row items-center justify-start mt-1`}>
                  {!!item.customer_name && (
                    <View style={tw`flex-row items-center mr-2`}>
                      <User width={14} height={14} color={colors.muted} />
                      <Text
                        style={[tw`ml-2 text-sm`, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.customer_name}
                      </Text>
                    </View>
                  )}
                  {!!(item as any).contact_phone && (
                    <View style={tw`flex-row items-center ml-4`}>
                      <Phone width={14} height={14} color={colors.muted} />
                      <Text
                        style={[tw`ml-2 text-sm`, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {(item as any).contact_phone}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={tw`flex-row mt-2`}>
                  {item.window_start && (
                    <View style={tw`px-2 py-1 rounded-xl mr-2`}>
                      <Text style={[tw`text-xs`, { color: colors.muted }]}>
                        {item.window_start
                          ? `Start ${item.window_start}`
                          : 'Start —'}
                      </Text>
                    </View>
                  )}
                  {item.window_end && (
                    <View style={tw`px-2 py-1 rounded-xl`}>
                      <Text style={[tw`text-xs`, { color: colors.muted }]}>
                        {item.window_end ? `End ${item.window_end}` : 'End —'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={tw`flex-row justify-between items-center mt-2`}>
                  <View
                    style={[
                      tw`px-2 py-1 rounded-xl`,
                      { backgroundColor: colors.main },
                    ]}
                  >
                    <Text style={[tw`text-xs`, { color: colors.text }]}>
                      {(item as any).stop_type}
                    </Text>
                  </View>
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      onPress={() => moveUp(index)}
                      disabled={upDisabled}
                      style={[
                        tw`px-2 py-2 rounded-xl mr-2`,
                        {
                          backgroundColor: colors.main,
                          opacity: upDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <ArrowUp width={16} height={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveDown(index)}
                      disabled={downDisabled}
                      style={[
                        tw`px-2 py-2 rounded-xl`,
                        {
                          backgroundColor: colors.main,
                          opacity: downDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <ArrowDown width={16} height={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={tw`px-4 mt-2 mb-8`}>
            <TouchableOpacity
              onPress={onPublish}
              disabled={publishing || stops.length === 0}
              style={[
                tw`px-4 py-3 rounded-2xl items-center`,
                {
                  backgroundColor:
                    publishing || stops.length === 0
                      ? colors.border
                      : colors.brand?.primary || '#2563eb',
                },
              ]}
            >
              <Text style={tw`text-white font-semibold`}>Publish Route</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* DRIVER PICKER MODAL */}
      <DriverPickerModal
        visible={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        drivers={allDrivers}
        selectedId={selectedDriver?.id ?? null}
        onSelect={(d: any) => {
          setDriverModalOpen(false);
          if (d) handleReassignDriver(d);
        }}
        colors={colors}
      />

      {/* STOP FORM MODAL */}
      <StopFormModal
        visible={false /* open elsewhere if needed */}
        onClose={() => {}}
        colors={colors}
        initial={null}
        onSubmit={async () => {}}
      />
    </KeyboardAvoidingView>
  );
}

/* ===== Stop form modal ===== */

function StopFormModal({
  visible,
  onClose,
  initial,
  onSubmit,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  initial: Stop | null;
  onSubmit: (form: Partial<Stop>) => void | Promise<void>;
  colors: any;
}) {
  const [customer, setCustomer] = useState(initial?.customer_name ?? '');
  const [address, setAddress] = useState(
    [
      initial?.address_line1,
      initial?.city,
      initial?.region,
      initial?.postal_code,
    ]
      .filter(Boolean)
      .join(', '),
  );
  const [line1, setLine1] = useState(initial?.address_line1 ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [postal, setPostal] = useState(initial?.postal_code ?? '');
  const [country, setCountry] = useState(initial?.country_code ?? 'US');
  const [lat, setLat] = useState<number | null>(initial?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(initial?.longitude ?? null);
  const [serviceMin, setServiceMin] = useState(
    initial?.planned_service_minutes
      ? String(initial.planned_service_minutes)
      : '10',
  );
  const [startHM, setStartHM] = useState(initial?.window_start ?? '');
  const [endHM, setEndHM] = useState(initial?.window_end ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (!address) return;
    const parts = address.split(', ');
    setLine1(parts[0] ?? '');
    setCity(parts[1] ?? '');
    setRegion(parts[2] ?? '');
    (async () => {
      try {
        const res = await fetch(
          `https://google-maps-geocoding3.p.rapidapi.com/geocode?address=${encodeURIComponent(
            address,
          )}`,
          {
            method: 'GET',
            headers: {
              'x-rapidapi-key':
                'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
              'x-rapidapi-host': 'google-maps-geocoding3.p.rapidapi.com',
            },
          },
        );
        const data = await res.json();
        if (data?.latitude && data?.longitude) {
          setLat(parseFloat(data.latitude));
          setLng(parseFloat(data.longitude));
        }
      } catch {}
    })();
  }, [address]);

  const submit = () => {
    if (!line1 || !city || !region) {
      Alert.alert('Missing address', 'Please complete the address.');
      return;
    }
    const payload: Partial<Stop> = {
      customer_name: customer || null,
      address_line1: line1,
      city,
      region,
      postal_code: postal || null,
      country_code: (country || 'US').toUpperCase(),
      latitude: lat,
      longitude: lng,
      planned_service_minutes: Number(serviceMin) || 10,
      window_start: startHM || null,
      window_end: endHM || null,
      notes: notes || null,
    };
    onSubmit(payload);
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 bg-black/40`}>
        <View
          style={[
            tw`mt-auto rounded-t-3xl p-4`,
            { backgroundColor: colors.main, maxHeight: '88%' },
          ]}
        >
          {/* Header */}
          <View style={tw`flex-row items-center mb-3`}>
            <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
              {initial ? 'Edit Stop' : 'Add Stop'}
            </Text>
            <View style={tw`flex-1`} />
            <TouchableOpacity onPress={onClose}>
              <CloseIcon width={22} height={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Field
            label="Customer"
            value={customer}
            onChangeText={setCustomer}
            colors={colors}
          />
          <FieldSuggestions
            label="Search Address"
            value={query}
            onChangeText={setQuery}
            colors={colors}
            suggestions={suggestions}
            setSuggestions={setSuggestions}
            setQuery={setQuery}
            setAddress={setAddress}
          />

          <Field
            label="Address Line 1 "
            value={line1}
            onChangeText={setLine1}
            colors={colors}
            required
          />
          <View style={tw`flex-row`}>
            <View style={tw`flex-1 mr-2`}>
              <Field
                label="City "
                value={city}
                onChangeText={setCity}
                colors={colors}
                required
              />
            </View>
            <View style={tw`flex-1`}>
              <Field
                label="State/Region "
                value={region}
                onChangeText={setRegion}
                colors={colors}
                required
              />
            </View>
          </View>
          <View style={tw`flex-row`}>
            <View style={tw`flex-1 mr-2`}>
              <Field
                label="Postal Code"
                value={postal}
                onChangeText={setPostal}
                colors={colors}
              />
            </View>
            <View style={tw`flex-1`}>
              <Field
                label="Country"
                value={country}
                onChangeText={setCountry}
                colors={colors}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Timing */}
          <View style={tw`flex-row`}>
            <View style={tw`flex-1 mr-2`}>
              <Text style={tw`text-gray-400 text-xs mb-1`}>
                Service Window Start
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Clock width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {startHM || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-gray-400 text-xs mb-1`}>
                Service Window End
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Clock width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {endHM || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={tw`text-gray-400 text-xs mb-1 mt-3`}>
            Planned Service (min)
          </Text>
          <View
            style={[
              tw`px-3 py-2 rounded-xl flex-row items-center mb-3`,
              { backgroundColor: colors.border },
            ]}
          >
            <TextInput
              value={serviceMin}
              onChangeText={setServiceMin}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={'#9CA3AF'}
              style={[tw`flex-1`, { color: colors.text, padding: 0 }]}
            />
          </View>

          <Text style={tw`text-gray-400 text-xs mb-1`}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes for this stop…"
            placeholderTextColor={'#9CA3AF'}
            multiline
            numberOfLines={3}
            style={[
              tw`px-3 py-2 rounded-xl mb-4`,
              {
                color: colors.text,
                backgroundColor: colors.border,
                minHeight: 80,
                textAlignVertical: 'top',
              },
            ]}
          />

          {/* Time pickers */}
          {showStartPicker && (
            <DateTimePicker
              mode="time"
              value={new Date(`1970-01-01T${startHM || '08:00'}:00`)}
              onChange={(_, d) => {
                if (d) setStartHM(toHHmm(d));
                if (Platform.OS === 'android') setShowStartPicker(false);
              }}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              mode="time"
              value={new Date(`1970-01-01T${endHM || '09:00'}:00`)}
              onChange={(_, d) => {
                if (d) setEndHM(toHHmm(d));
                if (Platform.OS === 'android') setShowEndPicker(false);
              }}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          )}

          {/* Footer */}
          <View style={tw`flex-row justify-end mt-2`}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                tw`px-4 py-3 rounded-2xl mr-2`,
                { backgroundColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              style={[
                tw`px-4 py-3 rounded-2xl`,
                { backgroundColor: colors.brand?.primary || '#2563eb' },
              ]}
            >
              <Text style={tw`text-white font-semibold`}>
                {initial ? 'Save' : 'Add Stop'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
