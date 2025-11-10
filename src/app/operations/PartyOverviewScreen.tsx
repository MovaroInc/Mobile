// src/app/customers/CustomerVendorOverviewScreen.tsx
// -----------------------------------------------------------------------------
// Purpose
//   Manager-facing overview for a single Customer or Vendor, similar to
//   DriverOverviewScreen but focused on business relationship metrics.
// -----------------------------------------------------------------------------

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import tw from 'twrnc';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import {
  ArrowLeft,
  RefreshCcw,
  Phone,
  MapPin,
  Navigation,
} from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
// TODO: adjust path to your helper function if different
import { getEntityById } from '../../shared/lib/EntityHelpers';

/* ───────────────── types ───────────────── */

type EntityType = 'customer' | 'vendor';

type Entity = {
  id: number | string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  lat?: number | null;
  lng?: number | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  notes?: string | null;

  // optional contact person fields used in the UI
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

type Metrics = {
  total_stops_assigned: number;
  total_stops_completed: number;
  total_stops_not_completed: number;
  total_amount_collected: number; // positive currency
  total_amount_paid: number; // positive currency
  last_activity_at?: string | null;
};

type StopSummary = {
  id: number | string;
  route_id?: number | string | null;
  name?: string | null;
  status?: string | null; // scheduled | en_route | arrived | completed | canceled
  amount_collected?: number | null; // display only
  amount_paid?: number | null; // display only
  completed_at?: string | null;
  address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

type EntityOverview = {
  entity: Entity & { type: EntityType };
  metrics: Metrics;
  stops: StopSummary[];
};

/* ───────────────── utils ───────────────── */

const currency = (n?: number | null) => {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
};

function MapBadge({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.06)',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#111' }}>
        {children}
      </Text>
    </View>
  );
}

/* ───────────────── screen ───────────────── */

export default function CustomerVendorOverviewScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  const entityId: number | string = route.params?.id;
  const entityType: EntityType = (route.params?.mode ||
    'customer') as EntityType;
  const initialEntity: Entity | null =
    (route.params?.initialEntity as Entity | undefined) || null;

  const [entity, setEntity] = useState<Entity | null>(initialEntity);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentStops, setRecentStops] = useState<StopSummary[]>([]);
  const [loading, setLoading] = useState(!initialEntity);
  const [refreshing, setRefreshing] = useState(false);

  const mapRef = useRef<MapView>(null);

  const hqCenter = useMemo<{
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

  const entityPoint = useMemo<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    if (typeof entity?.lng === 'number' && typeof entity?.lat === 'number') {
      return { longitude: entity.lng!, latitude: entity.lat! };
    }
    return null;
  }, [entity]);

  const initialRegion = useMemo(() => {
    const center = entityPoint ||
      hqCenter || { latitude: 39.5, longitude: -98.35 };
    const delta = entityPoint ? 0.04 : hqCenter ? 0.08 : 30;
    return { ...center, latitudeDelta: delta, longitudeDelta: delta };
  }, [entityPoint, hqCenter]);

  /* ─────────────── data fetchers ─────────────── */

  const hydrateAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const resp = await getEntityById(Number(entityId), entityType);
      // resp expected shape: { success, data: { entity, metrics, stops } }
      const payload: EntityOverview | null = resp?.success ? resp.data : null;
      if (!payload) {
        setMetrics(null);
        setRecentStops([]);
        return;
      }

      const e = payload.entity as Entity;
      const m = payload.metrics as Metrics;
      const stops = Array.isArray(payload.stops) ? payload.stops : [];

      const normalizedStops = stops.map(s => ({
        ...s,
        address:
          s.address ||
          [s.address_line1, s.city, s.state, s.postal_code]
            .filter(Boolean)
            .join(', '),
      }));

      setEntity(prev => ({ ...(prev || ({} as any)), ...e }));
      setMetrics(m || null);
      setRecentStops(normalizedStops);
    } catch {
      setMetrics(null);
      setRecentStops([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrateAll();
    setRefreshing(false);
  }, [hydrateAll]);

  useFocusEffect(
    useCallback(() => {
      void hydrateAll();
    }, [hydrateAll]),
  );

  /* ─────────────── actions ─────────────── */

  const onBack = () => nav.goBack();
  const onCall = () => entity?.phone && Linking.openURL(`tel:${entity.phone}`);

  /* ─────────────── render ─────────────── */

  if (loading && !entity) {
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

  const title =
    entity?.name || (entityType === 'customer' ? 'Customer' : 'Vendor');
  const addressLine = [
    entity?.address_line1,
    entity?.city,
    entity?.state,
    entity?.postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  const assigned = metrics?.total_stops_assigned ?? 0;
  const completed = metrics?.total_stops_completed ?? 0;
  const notCompleted =
    metrics?.total_stops_not_completed ?? Math.max(assigned - completed, 0);
  const collectedAmt = metrics?.total_amount_collected ?? 0;
  const paidAmt = metrics?.total_amount_paid ?? 0;
  const netAmt = collectedAmt - paidAmt; // positive if net collected

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
            {title}
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
          initialRegion={initialRegion}
          showsUserLocation={false}
          toolbarEnabled={false}
          showsCompass
        >
          {/* HQ pin */}
          {hqCenter && (
            <Marker coordinate={hqCenter}>
              <View style={{ alignItems: 'center' }}>
                <MapBadge>{(business as any)?.name || 'HQ'}</MapBadge>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#111827',
                    borderWidth: 2,
                    borderColor: '#fff',
                    marginTop: 6,
                  }}
                />
              </View>
            </Marker>
          )}

          {/* Entity pin */}
          {entityPoint && (
            <Marker coordinate={entityPoint}>
              <View style={{ alignItems: 'center' }}>
                <MapBadge>
                  <Text
                    style={{ fontSize: 11, fontWeight: '700', color: '#111' }}
                  >
                    {title}
                  </Text>
                </MapBadge>
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <MapPin width={20} height={20} color="#DC2626" />
                </View>
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
        {/* Identity */}
        <Section
          title={entityType === 'customer' ? 'Customer' : 'Vendor'}
          colors={colors}
        >
          <Row label="ID" value={String(entityId)} colors={colors} />
          <Row label="Name" value={entity?.name || '—'} colors={colors} />
          <Row label="Phone" value={entity?.phone || '—'} colors={colors} />
          <Row label="Email" value={entity?.email || '—'} colors={colors} />
          <Row label="Address" value={addressLine || '—'} colors={colors} />
          <View style={tw`flex-row items-center p-2`}>
            {entity?.phone ? (
              <TouchableOpacity
                onPress={onCall}
                style={[
                  tw`self-start mt-2 px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Phone width={16} height={16} color="#fff" />
                  <Text style={tw`text-white font-semibold ml-2`}>Call</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            {typeof entity?.lat === 'number' &&
            typeof entity?.lng === 'number' ? (
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${entity?.lat},${entity?.lng}`,
                  );
                }}
                style={[
                  tw`self-start mt-2 px-3 py-2 rounded-xl ml-4`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Navigation width={16} height={16} color="#fff" />
                  <Text style={tw`text-white font-semibold ml-2`}>
                    Directions
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </Section>

        <Section title={'Contact Information'} colors={colors}>
          <Row
            label="Name"
            value={entity?.contact_name || '—'}
            colors={colors}
          />
          <Row
            label="Phone"
            value={entity?.contact_phone || '—'}
            colors={colors}
          />
          <Row
            label="Email"
            value={entity?.contact_email || '—'}
            colors={colors}
          />
        </Section>

        {/* Summary stats */}
        <View style={tw`px-4 mt-3`}>
          <View style={tw`flex-row`}>
            <StatCard
              label="Stops Assigned"
              value={String(assigned)}
              colors={colors}
            />
            <View style={tw`w-3`} />
            <StatCard
              label="Completed"
              value={String(completed)}
              colors={colors}
            />
          </View>
          <View style={tw`h-3`} />
          <View style={tw`flex-row`}>
            <StatCard
              label="Not Completed"
              value={String(notCompleted)}
              colors={colors}
            />
            <View style={tw`w-3`} />
            <StatCard
              label="Last Activity"
              value={
                metrics?.last_activity_at
                  ? new Date(metrics.last_activity_at).toLocaleString()
                  : '—'
              }
              colors={colors}
            />
          </View>
        </View>

        {/* Financials */}
        <Section title="Financials" colors={colors}>
          <Row
            label={
              entityType === 'customer'
                ? 'Amount Collected'
                : 'Amount Received from'
            }
            value={currency(collectedAmt)}
            colors={colors}
          />
          <Row
            label={
              entityType === 'vendor'
                ? 'Amount Paid (to vendor)'
                : 'Amount Paid'
            }
            value={currency(paidAmt)}
            colors={colors}
          />
          <Row label="Net" value={currency(netAmt)} colors={colors} />
          <Text style={[tw`text-2xs mt-2`, { color: colors.muted }]}>
            Net = Collected - Paid. For customers, Paid may be 0. For vendors,
            Collected may be 0. Adjust as needed.
          </Text>
        </Section>

        {/* Recent stops */}
        <Section title="Recent Stops" colors={colors}>
          {recentStops.length === 0 ? (
            <Text style={[tw`text-2xs`, { color: colors.muted }]}>
              No recent stops.
            </Text>
          ) : (
            recentStops.map(s => (
              <View
                key={String(s.id)}
                style={[
                  tw`mb-1 px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.button },
                ]}
              >
                <Text
                  style={[tw`text-sm font-semibold`, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {s.name || `Stop #${s.id}`}
                </Text>
                <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                  {s.address || '—'}
                </Text>
                <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
                  {(s.status || '—').replace('_', ' ')}
                  {s.completed_at
                    ? ` • ${new Date(s.completed_at).toLocaleString()}`
                    : ''}
                </Text>
                {s.amount_collected ?? s.amount_paid ? (
                  <Text style={[tw`text-2xs mt-0.5`, { color: colors.text }]}>
                    {s.amount_collected
                      ? `Collected: ${currency(s.amount_collected)}`
                      : ''}
                    {s.amount_paid
                      ? `${s.amount_collected ? ' • ' : ''}Paid: ${currency(
                          s.amount_paid,
                        )}`
                      : ''}
                  </Text>
                ) : null}
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
        {label === 'Phone' ? `+${value}` : value}
      </Text>
    </View>
  );
}

function StatCard({
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
        tw`flex-1 px-3 py-3 rounded-2xl`,
        { backgroundColor: colors.card },
      ]}
    >
      <Text style={[tw`text-2xs`, { color: colors.muted }]}>{label}</Text>
      <Text
        style={[tw`text-lg font-bold mt-0.5`, { color: colors.text }]}
        numberOfLines={1}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Router wiring tips
//   • Register a new stack route: CustomerVendorOverview
//   • From Operations → Customers/Vendors list: onPress → navigate with entityType/entityId
//   • Keep types narrow by creating a union param list for the navigator.
// -----------------------------------------------------------------------------
