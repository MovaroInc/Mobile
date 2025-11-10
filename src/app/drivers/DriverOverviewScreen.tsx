// src/app/drivers/DriverOverviewScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import tw from 'twrnc';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { Phone, ArrowLeft, RefreshCcw } from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';
import { getDrivers } from '../../shared/lib/DriversHelpers';
import { grabRouteProfileAndDate } from '../../shared/lib/RouteHelpers';
import {
  useLiveLocations,
  lastSeenText,
} from '../../shared/hooks/useLiveLocations';

/* ───────────────── types ───────────────── */

type DriverStatus = 'on_route' | 'available' | 'off_duty' | 'pending';

type Profile = {
  id: number; // profile_id
  business_id?: number | null;
  employee_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  status?: DriverStatus | null;
  availability?: DriverStatus | null;

  // hydrated live fields
  lat?: number | null;
  lng?: number | null;
  battery?: number | null;
  last_seen_at?: string | null;

  // optional decorations from your existing list API
  route_name?: string | null;
  next_eta?: string | null;
};

type RouteSummary = {
  id: number;
  name?: string | null;
  service_date?: string | null; // yyyy-mm-dd
  stops?: any[];
  completed_count?: number;
  total_count?: number;
};

type StopSummary = {
  id: number;
  name?: string | null;
  address?: string | null;
  status?: string | null;
  completed_at?: string | null;
};

/* ───────────────── utils ───────────────── */

const toISODate = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const today = toISODate();

const initials = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'DR';
};

const displayName = (p?: Profile | null) =>
  [p?.first_name ?? '', p?.last_name ?? ''].join(' ').trim() ||
  p?.email ||
  p?.phone ||
  'Driver';

const statusColor = (s?: DriverStatus | null) => {
  switch (s) {
    case 'on_route':
      return '#10B981';
    case 'available':
      return '#3B82F6';
    case 'pending':
      return '#F59E0B';
    case 'off_duty':
    default:
      return '#9CA3AF';
  }
};

function MapLabel({ text, style }: { text: string; style?: any }) {
  return (
    <View
      style={[
        {
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 2,
          elevation: 2,
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#111' }}>
        {text}
      </Text>
    </View>
  );
}

/* ───────────────── screen ───────────────── */

export default function DriverOverviewScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  // comes from navigation
  const profileId = route.params?.profileId as number;
  const initialProfile =
    (route.params?.initialProfile as Profile | undefined) || null;

  // live location (keyed by profile_id)
  const { rowsMap } = useLiveLocations(business?.id);
  const live = rowsMap[profileId];

  // state
  const [profile, setProfile] = useState<Profile | null>(
    initialProfile || null,
  );
  const [loading, setLoading] = useState(!initialProfile);
  const [refreshing, setRefreshing] = useState(false);

  // today snapshots
  const [todayTimesheet, setTodayTimesheet] = useState<any | null>(null);
  const [routeToday, setRouteToday] = useState<RouteSummary | null>(null);

  // short history
  const [recentRoutes, setRecentRoutes] = useState<RouteSummary[]>([]);
  const [recentStops, setRecentStops] = useState<StopSummary[]>([]);

  // map
  const mapRef = useRef<MapView>(null);

  const businessCenter = useMemo<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    const lng =
      (business as any)?.longitude ??
      (business as any)?.lng ??
      (business as any)?.hq_lng;
    const lat =
      (business as any)?.latitude ??
      (business as any)?.lat ??
      (business as any)?.hq_lat;
    return typeof lng === 'number' && typeof lat === 'number'
      ? { longitude: lng, latitude: lat }
      : null;
  }, [business]);

  const driverPoint = useMemo<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    if (typeof live?.lng === 'number' && typeof live?.lat === 'number')
      return { longitude: live.lng, latitude: live.lat };
    if (typeof profile?.lng === 'number' && typeof profile?.lat === 'number')
      return { longitude: profile.lng!, latitude: profile.lat! };
    return null;
  }, [live, profile]);

  const mapRegion = useMemo(() => {
    // If both points exist, fit later via effect; otherwise center with deltas.
    const center = driverPoint ||
      businessCenter || { latitude: 39.5, longitude: -98.35 };
    // heuristic deltas based on which center we have
    const latitudeDelta = driverPoint ? 0.04 : businessCenter ? 0.07 : 30;
    const longitudeDelta = driverPoint ? 0.04 : businessCenter ? 0.07 : 30;
    return { ...center, latitudeDelta, longitudeDelta };
  }, [driverPoint, businessCenter]);

  // Fit to both pins if we have them
  useEffect(() => {
    if (!mapRef.current) return;
    if (driverPoint && businessCenter) {
      mapRef.current.fitToCoordinates([driverPoint, businessCenter], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [driverPoint, businessCenter]);

  /* ─────────────── data fetchers ─────────────── */

  const hydrateProfile = useCallback(async () => {
    if (!business?.id || !profileId) return;
    setLoading(true);
    try {
      // Prefer a direct endpoint if you have it
      const list = (await getDrivers(business.id)).data ?? [];
      const d = list.find((x: any) => x.id === profileId) || null;
      const p: Profile | null = d
        ? {
            id: d.id,
            business_id: d.business_id ?? business.id,
            employee_id: d.employee_id ?? null,
            first_name: d?.Profile?.first_name ?? d.first_name ?? null,
            last_name: d?.Profile?.last_name ?? d.last_name ?? null,
            phone: d.phone ?? null,
            email: d.email ?? null,
            photo_url: d.photo_url ?? null,
            status: d.status ?? null,
            availability: d.availability ?? null,
            route_name: d.route_name ?? null,
            next_eta: d.next_eta ?? null,
          }
        : null;

      setProfile(prev => ({ ...(prev || ({} as any)), ...(p || {}) }));
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, [business?.id, profileId]);

  const hydrateTimesheetToday = useCallback(async () => {
    if (!profileId) return;
    try {
      const res = await api.get(
        `/drivers/get-driver-time-entries/${profileId}/${today}`,
      );
      const data = Array.isArray(res?.data?.data) ? res.data.data : [];
      setTodayTimesheet(data?.[0] || null);
    } catch {
      setTodayTimesheet(null);
    }
  }, [profileId]);

  const hydrateRouteToday = useCallback(async () => {
    if (!profileId) return;
    try {
      const r = await grabRouteProfileAndDate(profileId, today);
      const raw = r?.data ?? null;
      const mapped: RouteSummary | null = raw
        ? {
            id: raw.id,
            name: raw.name || raw.route_name || null,
            service_date: raw.service_date || today,
            stops: Array.isArray(raw.stops) ? raw.stops : [],
            completed_count: raw.completed_count ?? undefined,
            total_count:
              raw.total_count ??
              (Array.isArray(raw.stops) ? raw.stops.length : undefined),
          }
        : null;
      setRouteToday(mapped);
    } catch {
      setRouteToday(null);
    }
  }, [profileId]);

  const hydrateHistory = useCallback(async () => {
    if (!profileId) return;
    try {
      // Hook up when API ready
      setRecentRoutes([]);
      setRecentStops([]);
    } catch {
      setRecentRoutes([]);
      setRecentStops([]);
    }
  }, [profileId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      hydrateProfile(),
      hydrateTimesheetToday(),
      hydrateRouteToday(),
      hydrateHistory(),
    ]);
    setRefreshing(false);
  }, [
    hydrateProfile,
    hydrateTimesheetToday,
    hydrateRouteToday,
    hydrateHistory,
  ]);

  useEffect(() => {
    if (!initialProfile) void hydrateProfile();
    void hydrateTimesheetToday();
    void hydrateRouteToday();
    void hydrateHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* live merge for last_seen + battery */
  const effectiveProfile: Profile | null = useMemo(() => {
    if (!profile) return null;
    if (!live) return profile;
    return {
      ...profile,
      lat: live.lat ?? profile.lat ?? null,
      lng: live.lng ?? profile.lng ?? null,
      last_seen_at:
        live.updated_at || live.client_ts || profile.last_seen_at || null,
      battery: (live as any)?.battery_pct ?? profile.battery ?? null,
    };
  }, [profile, live]);

  /* ─────────────── actions ─────────────── */

  const onBack = () => nav.goBack();
  const onCall = () => {
    const phone = effectiveProfile?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  /* ─────────────── render ─────────────── */

  if (loading && !effectiveProfile) {
    return (
      <View
        style={[
          tw`flex-1 items-center justify-center`,
          { backgroundColor: colors.bg },
        ]}
      >
        <ActivityIndicator />
        <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
          Loading driver…
        </Text>
      </View>
    );
  }

  const name = displayName(effectiveProfile);
  const status: DriverStatus | undefined = (effectiveProfile?.availability ||
    effectiveProfile?.status ||
    undefined) as DriverStatus | undefined;

  const lastSeen = effectiveProfile?.last_seen_at
    ? lastSeenText(effectiveProfile?.last_seen_at)
    : 'Last seen: —';
  const batteryText =
    typeof effectiveProfile?.battery === 'number'
      ? `${effectiveProfile?.battery}%`
      : '—';

  const clockIn = todayTimesheet?.clock_in
    ? new Date(todayTimesheet.clock_in).toLocaleTimeString()
    : '—';
  const clockOut = todayTimesheet?.clock_out
    ? new Date(todayTimesheet.clock_out).toLocaleTimeString()
    : '—';

  const stops = Array.isArray(routeToday?.stops) ? routeToday.stops : [];
  const nextStop =
    stops.find((s: any) => (s.status || '').toLowerCase() === 'en_route') ||
    stops.find((s: any) => (s.status || '').toLowerCase() === 'arrived') ||
    stops.find((s: any) => (s.status || '').toLowerCase() === 'scheduled');

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2 flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity
            onPress={onBack}
            style={[
              tw`p-2 rounded-lg mr-2`,
              { backgroundColor: colors.border },
            ]}
          >
            <ArrowLeft width={18} height={18} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={[tw`text-2xl font-bold`, { color: colors.text }]}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[tw`p-2 rounded-lg`, { backgroundColor: colors.border }]}
        >
          <RefreshCcw width={16} height={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={tw`h-64 mx-4 rounded-2xl overflow-hidden mb-3`}>
        <MapView
          ref={mapRef}
          style={tw`flex-1`}
          initialRegion={mapRegion}
          showsUserLocation={false}
          toolbarEnabled={false}
          showsCompass
        >
          {/* HQ pin + label */}
          {businessCenter && (
            <Marker coordinate={businessCenter}>
              <View style={{ alignItems: 'center' }}>
                <MapLabel
                  text={business?.name || 'HQ'}
                  style={{ marginBottom: 6 }}
                />
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#111827',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                />
              </View>
            </Marker>
          )}

          {/* Driver pin + label */}
          {driverPoint && (
            <Marker coordinate={driverPoint}>
              <View style={{ alignItems: 'center' }}>
                <MapLabel
                  text={`${initials(name)} • ${lastSeen.replace(
                    'Last seen: ',
                    '',
                  )}`}
                  style={{ marginBottom: 6 }}
                />
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: statusColor(status),
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                />
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={tw`pb-24`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* IDs / associations */}
        <Section title="Identifiers" colors={colors}>
          <Row label="Profile ID" value={String(profileId)} colors={colors} />
          <Row
            label="Business ID"
            value={String(effectiveProfile?.business_id ?? business?.id ?? '—')}
            colors={colors}
          />
          <Row
            label="Employee ID"
            value={String(effectiveProfile?.employee_id ?? '—')}
            colors={colors}
          />
        </Section>

        {/* Quick stats */}
        <View style={tw`px-4 mt-3`}>
          <View style={tw`flex-row`}>
            <StatCard
              label="Status"
              value={
                status === 'on_route'
                  ? 'On Route'
                  : status === 'available'
                  ? 'Available'
                  : status === 'pending'
                  ? 'Pending'
                  : 'Off Duty'
              }
              badgeColor={statusColor(status)}
              colors={colors}
            />
            <View style={tw`w-3`} />
            <StatCard
              label="Last Seen"
              value={lastSeen.replace('Last seen: ', '')}
              colors={colors}
            />
          </View>
          <View style={tw`h-3`} />
          <View style={tw`flex-row`}>
            <StatCard label="Battery" value={batteryText} colors={colors} />
            <View style={tw`w-3`} />
            <StatCard
              label="Route"
              value={routeToday?.name || '—'}
              colors={colors}
            />
          </View>
        </View>

        {/* Contact */}
        <Section title="Contact" colors={colors}>
          <View style={tw`flex-row items-center justify-between`}>
            <View>
              <Text style={[tw`text-sm`, { color: colors.text }]}>
                {effectiveProfile?.phone || '—'}
              </Text>
              <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                {effectiveProfile?.email || '—'}
              </Text>
            </View>
            {effectiveProfile?.phone ? (
              <TouchableOpacity
                onPress={onCall}
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Phone width={16} height={16} color="#fff" />
                  <Text style={tw`text-white font-semibold ml-2`}>Call</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </Section>

        {/* Today’s timesheet */}
        <Section title="Today’s Timesheet" colors={colors}>
          <View style={tw`flex-row`}>
            <MiniStat label="Clock In" value={clockIn} colors={colors} />
            <View style={tw`w-3`} />
            <MiniStat label="Clock Out" value={clockOut} colors={colors} />
            <View style={tw`w-3`} />
            <MiniStat
              label="Break (min)"
              value={todayTimesheet?.break_minutes_total ?? '—'}
              colors={colors}
            />
          </View>
        </Section>

        {/* Current route snapshot */}
        <Section title="Route Snapshot (Today)" colors={colors}>
          <Text style={[tw`text-sm`, { color: colors.text }]}>
            {routeToday?.name || '—'}
          </Text>
          <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
            {routeToday?.stops?.length
              ? `${routeToday.stops.length} stops`
              : '—'}
          </Text>

          {nextStop ? (
            <View
              style={[
                tw`mt-3 px-3 py-2 rounded-xl`,
                { backgroundColor: colors.border },
              ]}
            >
              <Text style={[tw`text-xs`, { color: colors.muted }]}>
                Up Next
              </Text>
              <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                {nextStop.business_name || nextStop.name || 'Stop'}
              </Text>
              <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                {nextStop.city ||
                  nextStop.address_line1 ||
                  nextStop.address ||
                  '—'}
              </Text>
            </View>
          ) : null}
        </Section>

        {/* Short history (recent routes & stops) */}
        <Section title="Recent Activity" colors={colors}>
          <Text style={[tw`text-xs mb-2`, { color: colors.muted }]}>
            Recent routes (limit 5) and stops (limit 20).
          </Text>

          {/* Routes */}
          <Text
            style={[tw`text-xs font-semibold mb-1`, { color: colors.text }]}
          >
            Routes
          </Text>
          {recentRoutes.length === 0 ? (
            <Text style={[tw`text-2xs mb-2`, { color: colors.muted }]}>
              No recent routes.
            </Text>
          ) : (
            recentRoutes.map(r => (
              <View
                key={r.id}
                style={[
                  tw`mb-2 px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[tw`text-sm font-semibold`, { color: colors.text }]}
                >
                  {r.name || `Route #${r.id}`}
                </Text>
                <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                  {r.service_date || '—'} •{' '}
                  {typeof r.total_count === 'number'
                    ? `${r.total_count} stops`
                    : '—'}
                </Text>
              </View>
            ))
          )}

          {/* Stops */}
          <Text
            style={[
              tw`text-xs font-semibold mt-2 mb-1`,
              { color: colors.text },
            ]}
          >
            Stops
          </Text>
          {recentStops.length === 0 ? (
            <Text style={[tw`text-2xs`, { color: colors.muted }]}>
              No recent stops.
            </Text>
          ) : (
            recentStops.map(s => (
              <View
                key={s.id}
                style={[
                  tw`mb-2 px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[tw`text-sm font-semibold`, { color: colors.text }]}
                >
                  {s.name || `Stop #${s.id}`}
                </Text>
                <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                  {s.address || '—'}
                </Text>
                <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                  {s.status || '—'}{' '}
                  {s.completed_at
                    ? `• ${new Date(s.completed_at).toLocaleString()}`
                    : ''}
                </Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

/* ───────────────── small components ───────────────── */

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View style={tw`px-4 mt-3`}>
      <Text style={[tw`text-base font-semibold mb-2`, { color: colors.text }]}>
        {title}
      </Text>
      <View style={[tw`rounded-2xl p-3`, { backgroundColor: colors.card }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={tw`flex-row items-center justify-between py-1`}>
      <Text style={[tw`text-xs`, { color: colors.muted }]}>{label}</Text>
      <Text
        style={[tw`text-xs font-semibold`, { color: colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
  badgeColor,
}: {
  label: string;
  value: string;
  colors: any;
  badgeColor?: string;
}) {
  return (
    <View
      style={[
        tw`flex-1 px-3 py-3 rounded-2xl`,
        { backgroundColor: colors.card },
      ]}
    >
      <Text style={[tw`text-2xs`, { color: colors.muted }]}>{label}</Text>
      <View style={tw`flex-row items-center mt-0.5`}>
        {badgeColor ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: badgeColor,
              marginRight: 6,
            }}
          />
        ) : null}
        <Text
          style={[tw`text-lg font-bold`, { color: colors.text }]}
          numberOfLines={1}
        >
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

function MiniStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string | number;
  colors: any;
}) {
  return (
    <View
      style={[
        tw`flex-1 px-3 py-2 rounded-xl`,
        { backgroundColor: colors.border },
      ]}
    >
      <Text style={[tw`text-2xs`, { color: colors.muted }]}>{label}</Text>
      <Text
        style={[tw`text-sm font-semibold mt-0.5`, { color: colors.text }]}
        numberOfLines={1}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}
