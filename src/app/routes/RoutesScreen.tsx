// src/app/routes/RouteScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  Calendar,
  PlusCircle,
  Map,
  Truck,
  Clock,
  Navigation,
  CheckCircle,
  AlertTriangle,
  BarChart2,
} from 'react-native-feather';
import { buildDateRange } from '../../shared/utils/dates';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSession } from '../../state/useSession';
import {
  getDraftRoutesByBusinessId,
  getRoutesByBusinessId,
} from '../../shared/lib/RouteHelpers';
import { getDrivers } from '../../shared/lib/DriversHelpers';

/* ─────────────────────────── Types ─────────────────────────── */

type RouteStatus =
  | 'draft'
  | 'planned'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | string;

type Stop = {
  id: number;
  route_id: number;
  planned_service_minutes?: number | null;
};

type DBRoute = {
  id: number;
  name: string;
  status: RouteStatus;
  employee_id: number | null; // driver's employee id
  planned_start_at?: string | null;
  service_date: string; // YYYY-MM-DD (normalized)
  stops?: Stop[];
};

type Employee = {
  id: number; // employee id
  work_email?: string | null;
  phone?: string | null;
  is_driver?: boolean | null;
  Profile?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

type UiDriver = { id: number; name: string };

/* ───────────────────── Local date helpers ───────────────────── */

function ymdToLocalDate(ymd: string) {
  // Parse 'YYYY-MM-DD' as local midnight (prevents UTC shift)
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdOnly(dateLike?: string | null) {
  // Normalize 'YYYY-MM-DD' or full ISO -> 'YYYY-MM-DD'
  return (dateLike ?? '').slice(0, 10);
}

/* ───────────────────────── Utilities ───────────────────────── */

function toDriverName(e: Employee): string {
  const fn = e.Profile?.first_name?.trim() ?? '';
  const ln = e.Profile?.last_name?.trim() ?? '';
  const full = `${fn} ${ln}`.trim();
  return full || e.work_email || e.Profile?.email || 'Unnamed';
}

function fmtDateHeader(d: Date, label?: string) {
  const wd = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return label ? `${label} — ${wd}, ${md}` : `${wd}, ${md}`;
}

function toHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/* ────────────────────────── Screen ─────────────────────────── */

export default function RouteScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  const items = buildDateRange(8); // [{ date, iso, label }] (may be UTC-based in your util)

  // Ensure default selected date is *local* today even if items[0] is skewed by UTC.
  const todayLocalISO = formatLocalYMD(new Date());
  const initialIso =
    items.find(i => i.iso === todayLocalISO)?.iso ?? items[0].iso;

  const [selectedIso, setSelectedIso] = useState(initialIso);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState<DBRoute[]>([]);
  const [draftRoutes, setDraftRoutes] = useState<DBRoute[]>([]);
  const [drivers, setDrivers] = useState<UiDriver[]>([]);

  // Load drivers + routes when business/date changes
  useFocusEffect(
    useCallback(() => {
      if (!business?.id) return;
      (async () => {
        setLoading(true);
        try {
          // drivers
          const drvRes = await getDrivers(business.id);
          const drvList: UiDriver[] = (drvRes?.data ?? [])
            .filter((e: Employee) => e.is_driver !== false)
            .map((e: Employee) => ({ id: e.id, name: toDriverName(e) }));
          setDrivers(drvList);

          // routes (normalize shapes + dates)
          console.log('onRefresh', business.id, selectedIso);
          const rRes = await getRoutesByBusinessId(business.id, selectedIso);
          if (rRes.error) {
            throw new Error('Failed to fetch routes: ' + rRes.error.message);
          }
          const rResDraft = await getDraftRoutesByBusinessId(
            business.id,
            selectedIso,
          );
          if (rResDraft.error) {
            throw new Error(
              'Failed to fetch draft routes: ' + rResDraft.error.message,
            );
          }
          setRoutes(rRes.data);
          setDraftRoutes(rResDraft.data);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed loading routes/drivers', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [business?.id, selectedIso]),
  );

  const onRefresh = async () => {
    if (!business?.id) return;
    setRefreshing(true);
    try {
      console.log('onRefresh', business.id, selectedIso);
      const rRes = await getRoutesByBusinessId(business.id, selectedIso);
      if (rRes.error) {
        throw new Error('Failed to fetch routes: ' + rRes.error.message);
      }
      const rResDraft = await getDraftRoutesByBusinessId(
        business.id,
        selectedIso,
      );
      if (rResDraft.error) {
        throw new Error(
          'Failed to fetch draft routes: ' + rResDraft.error.message,
        );
      }
      setRoutes(rRes.data);
      setDraftRoutes(rResDraft.data);
    } finally {
      setRefreshing(false);
    }
  };

  // Derived view for the selected *local* day
  const view = useMemo(() => {
    // Filter by normalized YMD
    const dayRoutes = routes.filter(
      r => ymdOnly(r.service_date) === selectedIso,
    );
    const allRoutes = routes;

    const totalRoutes = dayRoutes.length;
    const totalStops = dayRoutes.reduce(
      (sum, r) => sum + (r.stops?.length ?? 0),
      0,
    );

    // employee_id -> route
    const driverAssignments: Record<number, DBRoute> = {};
    dayRoutes.forEach(r => {
      if (r.employee_id != null) driverAssignments[r.employee_id] = r;
    });

    // Unassigned drivers count
    const unassignedDrivers = drivers.filter(
      d => !(d.id in driverAssignments),
    ).length;

    // Header title with local date
    const selected = items.find(i => i.iso === selectedIso) ?? items[0];
    const d = ymdToLocalDate(selected.iso);

    const today = initialIso;
    const tomorrow = items[1]?.iso;
    const nextDay = items[2]?.iso;

    const headerTitle =
      selected.iso === today
        ? fmtDateHeader(d, 'Today')
        : selected.iso === tomorrow
        ? fmtDateHeader(d, 'Tomorrow')
        : selected.iso === nextDay
        ? fmtDateHeader(d, 'Next Day')
        : fmtDateHeader(d);

    return {
      headerTitle,
      routes: dayRoutes,
      summary: { totalRoutes, totalStops, unassignedDrivers },
      driverAssignments,
      allRoutes,
    };
  }, [routes, drivers, items, selectedIso, initialIso]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg ?? colors.main }]}>
      {/* FAB */}
      <View style={tw`absolute z-10 right-0 bottom-0 px-3 pb-4`}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            tw`px-3 py-2 rounded-full flex-row items-center`,
            { backgroundColor: colors.brand.primary },
          ]}
          onPress={() => navigation.navigate('CreateRouteStep1')}
        >
          <PlusCircle width={18} height={18} color="#fff" />
          <Text style={tw`text-white ml-2 font-semibold`}>Create Route</Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2 flex-row items-center justify-between`}>
        <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
          Routes
        </Text>
        <View style={tw`flex-row items-center`}>
          {loading ? <ActivityIndicator /> : null}
          <TouchableOpacity
            onPress={() => navigation.navigate('RouteAnalytics')}
            style={[
              tw`p-2 rounded-2 ml-3`,
              {
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.borderSecondary,
              },
            ]}
          >
            <BarChart2 width={16} height={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date chips */}
      <View style={tw`px-3 mb-2`}>
        <View
          style={[
            tw`flex-row rounded-xl p-1`,
            { backgroundColor: colors.bg ?? colors.main },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              tw`flex-row px-.5 py-2 rounded-2`,
              { backgroundColor: colors.border },
            ]}
          >
            {items.map(i => {
              const active = i.iso === selectedIso;
              const [dow, mon, day] = i.label.split(' ');
              const monthDay = `${mon} ${day}`;
              return (
                <TouchableOpacity
                  key={i.iso}
                  onPress={() => setSelectedIso(i.iso)}
                  style={[
                    tw`px-3 py-2 mx-1 rounded-lg items-center`,
                    {
                      backgroundColor: active
                        ? colors.brand.primary
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '600',
                    }}
                  >
                    {dow}
                  </Text>
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '600',
                    }}
                  >
                    {monthDay}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`pb-28`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={tw`px-4 mt-3`}>
          {/* Day header */}
          <View style={tw`flex-row items-center mb-2`}>
            <Calendar width={16} height={16} color={colors.text} />
            <Text
              style={[tw`ml-2 text-base font-semibold`, { color: colors.text }]}
            >
              {view.headerTitle}
            </Text>
          </View>

          {/* Summary row */}
          <View style={tw`flex-row mb-2`}>
            <SummaryCard
              Icon={Map}
              label="Routes"
              value={String(view.summary.totalRoutes)}
              colors={colors}
            />
            <View style={tw`w-2`} />
            <SummaryCard
              Icon={Navigation}
              label="Stops"
              value={String(view.summary.totalStops)}
              colors={colors}
            />
            <View style={tw`w-2`} />
            <SummaryCard
              Icon={Truck}
              label="Unassigned"
              value={String(view.summary.unassignedDrivers)}
              colors={colors}
            />
          </View>

          {/* Drivers list */}
          <FlatList
            data={drivers}
            keyExtractor={d => String(d.id)}
            scrollEnabled={false}
            ListHeaderComponent={
              <Text
                style={[tw`text-lg mb-1 font-semibold`, { color: colors.text }]}
              >
                Drivers
              </Text>
            }
            ListEmptyComponent={
              <Text style={[tw`text-xs mt-2`, { color: '#9CA3AF' }]}>
                No drivers found.
              </Text>
            }
            renderItem={({ item }) => {
              const route = view.driverAssignments[item.id] ?? null;
              return (
                <DriverRow
                  driver={item}
                  route={route}
                  colors={colors}
                  onCreate={() =>
                    navigation.navigate('CreateRouteStep1', {
                      driverId: item.id,
                      serviceDateISO: selectedIso,
                    })
                  }
                  onOpen={() => {
                    if (route?.id)
                      navigation.navigate('RouteDraftScreen', {
                        routeId: route.id,
                        payload: route,
                      });
                  }}
                />
              );
            }}
          />

          {/* Routes preview */}
          {view.allRoutes.length > 0 ? (
            <View style={tw`mt-3`}>
              <Text
                style={[tw`text-xl mb-2 font-semibold`, { color: colors.text }]}
              >
                Routes
              </Text>
              {routes.map(r => {
                const stopsCount = r.stops?.length ?? 0;
                const durationMin =
                  (r.stops ?? []).reduce(
                    (sum, s) => sum + (s.planned_service_minutes ?? 10),
                    0,
                  ) || stopsCount * 10;
                const driverName =
                  drivers.find(d => d.id === r.employee_id)?.name ??
                  'Unassigned';
                const startHM = r.planned_start_at
                  ? new Date(r.planned_start_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                return (
                  <TouchableOpacity
                    key={r.id}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('RouteDraftScreen', {
                        routeId: r.id,
                        payload: r,
                      })
                    }
                    style={[
                      tw`mb-3 px-4 py-3 rounded-2xl`,
                      { backgroundColor: colors.borderSecondary },
                    ]}
                  >
                    <View style={tw`flex-row items-center justify-between`}>
                      <Text
                        style={[
                          tw`text-base font-semibold`,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <StatusPill status={r.status} colors={colors} />
                    </View>

                    <View style={tw`flex-row items-center mt-2`}>
                      <Truck width={14} height={14} color="#9CA3AF" />
                      <Text
                        style={tw`text-gray-400 text-xs ml-1`}
                        numberOfLines={1}
                      >
                        {driverName}
                      </Text>
                      <View style={tw`w-3`} />
                      <Navigation width={14} height={14} color="#9CA3AF" />
                      <Text style={tw`text-gray-400 text-xs ml-1`}>
                        {stopsCount} stops
                      </Text>
                      <View style={tw`w-3`} />
                      <Clock width={14} height={14} color="#9CA3AF" />
                      <Text style={tw`text-gray-400 text-xs ml-1`}>
                        {toHM(durationMin)}
                        {startHM ? ` • ${startHM}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[tw`text-xs mt-4`, { color: '#9CA3AF' }]}>
              No routes for this day.
            </Text>
          )}
          {draftRoutes.length > 0 ? (
            <View style={tw`mt-3`}>
              <Text
                style={[tw`text-xl mb-2 font-semibold`, { color: colors.text }]}
              >
                Draft Routes
              </Text>
              {draftRoutes.map(r => {
                const stopsCount = r.stops?.length ?? 0;
                const durationMin =
                  (r.stops ?? []).reduce(
                    (sum, s) => sum + (s.planned_service_minutes ?? 10),
                    0,
                  ) || stopsCount * 10;
                const driverName =
                  drivers.find(d => d.id === r.employee_id)?.name ??
                  'Unassigned';
                const startHM = r.planned_start_at
                  ? new Date(r.planned_start_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                return (
                  <TouchableOpacity
                    key={r.id}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('RouteDraftScreen', {
                        routeId: r.id,
                        payload: r,
                      })
                    }
                    style={[
                      tw`mb-3 px-4 py-3 rounded-2xl`,
                      { backgroundColor: colors.borderSecondary },
                    ]}
                  >
                    <View style={tw`flex-row items-center justify-between`}>
                      <Text
                        style={[
                          tw`text-base font-semibold`,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <StatusPill status={r.status} colors={colors} />
                    </View>

                    <View style={tw`flex-row items-center mt-2`}>
                      <Truck width={14} height={14} color="#9CA3AF" />
                      <Text
                        style={tw`text-gray-400 text-xs ml-1`}
                        numberOfLines={1}
                      >
                        {driverName}
                      </Text>
                      <View style={tw`w-3`} />
                      <Navigation width={14} height={14} color="#9CA3AF" />
                      <Text style={tw`text-gray-400 text-xs ml-1`}>
                        {stopsCount} stops
                      </Text>
                      <View style={tw`w-3`} />
                      <Clock width={14} height={14} color="#9CA3AF" />
                      <Text style={tw`text-gray-400 text-xs ml-1`}>
                        {toHM(durationMin)}
                        {startHM ? ` • ${startHM}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[tw`text-xs mt-4`, { color: '#9CA3AF' }]}>
              No routes for this day.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────────────────── Small components ───────────────────── */

function SummaryCard({
  Icon,
  label,
  value,
  colors,
}: {
  Icon: any;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      style={[
        tw`flex-1 px-3 py-3 rounded-2xl`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={[tw`text-xs`, { color: '#9CA3AF' }]}>{label}</Text>
        <Icon width={14} height={14} color={colors.text} />
      </View>
      <Text style={[tw`text-xl font-bold mt-1`, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function DriverRow({
  driver,
  route,
  colors,
  onCreate,
  onOpen,
}: {
  driver: UiDriver;
  route: DBRoute | null;
  colors: any;
  onCreate: () => void;
  onOpen: () => void;
}) {
  return (
    <View
      style={[
        tw`mb-2 px-4 py-3 rounded-2xl`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
          {driver.name}
        </Text>
        {route ? (
          <TouchableOpacity onPress={onOpen} style={tw`ml-3`}>
            <Text
              style={[tw`text-xs font-semibold`, { color: colors.primary }]}
            >
              Open
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onCreate} style={tw`ml-3`}>
            <Text
              style={[tw`text-xs font-semibold`, { color: colors.primary }]}
            >
              Create
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={tw`flex-row items-center mt-2`}>
        {route ? (
          <>
            <CheckCircle width={14} height={14} color="#10B981" />
            <Text style={tw`text-gray-300 text-xs ml-1`} numberOfLines={1}>
              {route.name} • {route.stops?.length ?? 0} stops
            </Text>
          </>
        ) : (
          <>
            <AlertTriangle width={14} height={14} color="#FBBF24" />
            <Text style={tw`text-gray-300 text-xs ml-1`}>
              No dispatched route assigned
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function StatusPill({ status, colors }: { status: RouteStatus; colors: any }) {
  const label =
    status === 'draft'
      ? 'Draft'
      : status === 'planned'
      ? 'Planned'
      : status === 'dispatched'
      ? 'Dispatched'
      : status === 'in_progress'
      ? 'In Progress'
      : status === 'completed'
      ? 'Completed'
      : String(status);

  const bg =
    status === 'draft'
      ? 'rgba(255,255,255,0.10)'
      : status === 'planned'
      ? 'rgba(59,130,246,0.20)'
      : status === 'dispatched'
      ? 'rgba(14,165,233,0.20)'
      : status === 'in_progress'
      ? 'rgba(16,185,129,0.20)'
      : 'rgba(148,163,184,0.20)';

  return (
    <View
      style={[
        tw`px-2 py-0.5 rounded-full`,
        {
          backgroundColor: bg,
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
        },
      ]}
    >
      <Text style={[tw`text-xs`, { color: colors.text }]}>{label}</Text>
    </View>
  );
}
