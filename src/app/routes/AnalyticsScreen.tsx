// src/app/analytics/AnalyticsScreen.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import tw from 'twrnc';
import {
  ArrowLeft,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
} from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import {
  getBusinessAdmin,
  getAnalyticsByDriverId,
} from '../../shared/lib/AnalyticsHelpers';

/* ─────────────── types ─────────────── */
type RangeKey = '1' | '7' | '30';
type TabKey = 'overall' | 'drivers';

type OverallStats = {
  totalRoutes: number;
  totalStops: number;
  completedRoutes: number;
  completedStops: number;
  notCompletedRoutes: number;
  notCompletedStops: number;
  totalAmountExpected: number; // cents
  totalAmountCollected: number; // cents
  totalAmountMissing: number; // cents
  totalAmountPaidOut: number; // cents
  totalAmountRefunded: number; // cents
  totalAveragePerStop: number; // cents
  totalFailedStops: number;
};

type DriverRowPayload = {
  employee: any; // { id, Profile?, first_name/last_name?, ... }
  totalRoutes: number;
  totalStops: number;
  completedRoutes: number;
  completedStops: number;
  notCompletedRoutes: number;
  notCompletedStops: number;
  totalAmountExpected: number; // cents
  totalAmountCollected: number; // cents
  totalAmountMissing: number; // cents
  totalAmountPaidOut: number; // cents
  totalAmountRefunded: number; // cents
  totalAveragePerStop: number; // cents
  totalFailedStops: number;
};

/* ─────────────── date helpers (local) ─────────────── */
function todayLocalYYYYMMDD(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function daysBeforeLocal(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return todayLocalYYYYMMDD(d);
}

/* ─────────────── currency helper ─────────────── */
/** Backend totals are in CENTS (e.g., 9401 => $94.01) */
const currencyFmt = (cents?: number | null) => {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  const dollars = n;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
};

/* ─────────────── misc helpers ─────────────── */
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const getEmployeeId = (e: any) =>
  e?.id ?? e?.employee_id ?? e?.profile_id ?? e?.Profile?.id ?? 'unknown';

const getEmployeeName = (e: any) => {
  const name =
    e?.name ??
    e?.full_name ??
    [e?.first_name, e?.last_name].filter(Boolean).join(' ') ??
    e?.Profile?.full_name ??
    e?.Profile?.name;
  const id = getEmployeeId(e);
  return name && String(name).trim().length
    ? String(name)
    : `Driver ${String(id)}`;
};

const pct = (done: number, total: number) =>
  total > 0 ? `${Math.round((done / total) * 100)}% conv.` : '0% conv.';

/* ─────────────── screen ─────────────── */
export default function AnalyticsScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  const [tab, setTab] = useState<TabKey>('overall');
  const [rangeKey, setRangeKey] = useState<RangeKey>('1');

  // end date is always today (local)
  const [endDate, setEndDate] = useState<string>(todayLocalYYYYMMDD());
  // start date is null for "Today"; otherwise inclusive start (local)
  const [startDate, setStartDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Overall
  const [overall, setOverall] = useState<OverallStats | null>(null);

  // Drivers
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverRows, setDriverRows] = useState<DriverRowPayload[]>([]);
  const [expandedDriverId, setExpandedDriverId] = useState<
    string | number | null
  >(null);
  const [drivers, setDrivers] = useState<any[]>([]);

  // Label under range chips
  const label = useMemo(() => {
    if (rangeKey === '1') return 'Today';
    if (rangeKey === '7') return 'Past 7 Days';
    return 'Past 30 Days';
  }, [rangeKey]);

  // Keep end date as "today (local)" and adjust start date per range
  useEffect(() => {
    const today = todayLocalYYYYMMDD(new Date());
    setEndDate(today);
    if (rangeKey === '1') {
      setStartDate(null);
    } else if (rangeKey === '7') {
      setStartDate(daysBeforeLocal(new Date(), 6)); // inclusive 7-day window
    } else {
      setStartDate(daysBeforeLocal(new Date(), 29)); // inclusive 30-day window
    }
  }, [rangeKey]);

  /* ─────────────── data fetchers ─────────────── */
  const fetchAnalytics = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const res = await getBusinessAdmin(business.id, startDate, endDate);
      if (!res?.success || !res?.data) {
        throw new Error(res?.message || 'Failed to fetch analytics');
      }
      setOverall(res.data as OverallStats);
    } catch {
      setOverall(null);
    } finally {
      setLoading(false);
    }
  }, [business?.id, startDate, endDate]);

  const fetchDrivers = useCallback(async () => {
    if (!business?.id) return;
    setDriversLoading(true);
    try {
      const res = await getAnalyticsByDriverId(business.id, startDate, endDate);
      if (!res.data) {
        setDrivers([]);
        setDriverRows([]);
        return;
      }
      setDrivers(res.data);
      setDriverRows(res.data.payload);
    } catch {
    } finally {
      setDriversLoading(false);
    }
  }, [business?.id, startDate, endDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAnalytics(), fetchDrivers()]);
    setRefreshing(false);
  }, [fetchAnalytics, fetchDrivers]);

  useLayoutEffect(() => {
    // initial load
    fetchAnalytics();
    fetchDrivers();
  }, []); // eslint-disable-line

  useEffect(() => {
    // reload when dates change
    fetchAnalytics();
    fetchDrivers();
  }, [fetchAnalytics, fetchDrivers]);

  /* ─────────────── small UI bits ─────────────── */

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={tw`px-4 mt-3`}>
      <Text style={[tw`text-base font-semibold mb-2`, { color: colors.text }]}>
        {title}
      </Text>
      <View style={[tw`rounded-2xl p-3`, { backgroundColor: colors.main }]}>
        {children}
      </View>
    </View>
  );

  const StatBox = ({
    label,
    value,
    sub,
  }: {
    label: string;
    value: string;
    sub?: string;
  }) => (
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
        {value}
      </Text>
      {!!sub && (
        <Text
          style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      )}
    </View>
  );

  // eslint-disable-next-line react/no-unstable-nested-components
  const SmallStat = ({ label, value }: { label: string; value: string }) => (
    <View
      style={[
        tw`flex-1 px-3 py-2 rounded-lg`,
        { backgroundColor: colors.border },
      ]}
    >
      <Text style={[tw`text-2xs`, { color: colors.muted }]}>{label}</Text>
      <Text
        style={[tw`text-sm font-semibold mt-0.5`, { color: colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );

  const RangeChip = ({ k, txt }: { k: RangeKey; txt: string }) => {
    const active = rangeKey === k;
    return (
      <TouchableOpacity
        onPress={() => setRangeKey(k)}
        style={[
          tw`px-3 py-1.5 rounded-lg mr-2`,
          { backgroundColor: active ? '#2563eb' : colors.border },
        ]}
      >
        <Text
          style={[
            tw`text-xs font-semibold`,
            { color: active ? '#fff' : colors.text },
          ]}
        >
          {txt}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ─────────────── render ─────────────── */

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center`}>
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={[
                tw`p-2 rounded-lg mr-2`,
                { backgroundColor: colors.button },
              ]}
            >
              <ArrowLeft width={18} height={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
              Analytics
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={[tw`p-2 rounded-lg`, { backgroundColor: colors.button }]}
          >
            <RefreshCcw width={16} height={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Range selector */}
      <View style={tw`px-4`}>
        <View style={tw`flex-row items-center`}>
          <RangeChip k="1" txt="Today" />
          <RangeChip k="7" txt="7d" />
          <RangeChip k="30" txt="30d" />
          <Text style={[tw`ml-auto text-xs`, { color: colors.muted }]}>
            {label}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={tw`px-4 mt-3`}>
        <View style={tw`flex-row bg-black/20 rounded-xl p-1`}>
          {(['overall', 'drivers'] as const).map(k => {
            const active = tab === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setTab(k)}
                style={[
                  tw`flex-1 py-2 rounded-lg items-center`,
                  { backgroundColor: active ? '#2563eb' : 'transparent' },
                ]}
              >
                <Text
                  style={{
                    color: active ? '#fff' : colors.text,
                    fontWeight: '600',
                  }}
                >
                  {k === 'overall' ? 'Overall' : 'By Driver'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Body */}
      {loading && tab === 'overall' ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
          <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
            Crunching numbers…
          </Text>
        </View>
      ) : tab === 'overall' ? (
        <ScrollView
          contentContainerStyle={tw`pb-20`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
        >
          <View style={tw`px-4 mt-4`}>
            <View>
              <Text
                style={[
                  tw`text-lg font-semibold mb-2 ml-2`,
                  { color: colors.text },
                ]}
              >
                Routes & Stops
              </Text>
            </View>
            {/* Routes */}
            <View style={tw`flex-row`}>
              <StatBox
                label="Routes (Total)"
                value={String(overall?.totalRoutes ?? 0)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Stops (Total)"
                value={String(overall?.totalStops ?? 0)}
              />
            </View>
            <View style={tw`h-3`} />

            {/* Stops */}
            <View style={tw`flex-row`}>
              <StatBox
                label="Routes (Completed)"
                value={String(overall?.completedRoutes ?? 0)}
                sub={
                  (overall?.totalRoutes ?? 0) > 0
                    ? `${Math.round(
                        ((overall?.completedRoutes ?? 0) /
                          (overall?.totalRoutes ?? 1)) *
                          100,
                      )}% conv.`
                    : '0% conv.'
                }
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Stops (Completed)"
                value={String(overall?.completedStops ?? 0)}
                sub={
                  (overall?.totalStops ?? 0) > 0
                    ? `${Math.round(
                        ((overall?.completedStops ?? 0) /
                          (overall?.totalStops ?? 1)) *
                          100,
                      )}% conv.`
                    : '0% conv.'
                }
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Routes (Not Completed)"
                value={String(overall?.notCompletedRoutes ?? 0)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Stops (Not Completed)"
                value={String(overall?.notCompletedStops ?? 0)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Routes (Draft)"
                value={String(overall?.draftRoutes ?? 0)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Stops (Scheduled)"
                value={String(overall?.scheduledStops ?? 0)}
              />
            </View>
            <View style={tw`h-3`} />

            <View>
              <Text
                style={[
                  tw`text-lg font-semibold mb-2 ml-2`,
                  { color: colors.text },
                ]}
              >
                Financial Summary
              </Text>
            </View>

            {/* Money: Expected / Collected */}
            <View style={tw`flex-row`}>
              <StatBox
                label="Collection (Expected)"
                value={currencyFmt(overall?.collectedExpected)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Payment (Expected)"
                value={currencyFmt(overall?.paidOutExpected)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Collected (Exact)"
                value={currencyFmt(overall?.totalAmountExpectedPaidOut)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Paid (Exact)"
                value={currencyFmt(overall?.totalAmountPaidOutMissing)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Collection (Remaining)"
                value={currencyFmt(overall?.collectedMissing)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Payment (Remaining)"
                value={currencyFmt(overall?.paidOutMissing)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Collection (Avg / Stop)"
                value={currencyFmt(overall?.avgStopCollected)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Payment (Avg / Stop)"
                value={currencyFmt(overall?.avgStopPaidOut)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Collection (Completed Stops)"
                value={currencyFmt(overall?.collectCompleted)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Payment (Completed Stops)"
                value={currencyFmt(overall?.paidOutCompleted)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Collection (Non-completed Stops)"
                value={currencyFmt(overall?.collectCompleted)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Payment (Non-completed Stops)"
                value={currencyFmt(overall?.paidOutCompleted)}
              />
            </View>
            <View style={tw`h-3`} />

            <View>
              <Text
                style={[
                  tw`text-lg font-semibold mb-2 ml-2`,
                  { color: colors.text },
                ]}
              >
                Stop Type Summary
              </Text>
            </View>

            <View style={tw`flex-row`}>
              <StatBox
                label="Deliveries (Completed)"
                value={String(overall?.completedDeliveries)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Deliveries (Non-completed)"
                value={String(overall?.incompleteDeliveries)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Pickups (Completed)"
                value={String(overall?.completedPickups)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Pickups (Non-completed)"
                value={String(overall?.incompletePickups)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Services (Completed)"
                value={String(overall?.completedService)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Services (Non-completed)"
                value={String(overall?.incompleteService)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Installations (Completed)"
                value={String(overall?.completedInstall)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Installations (Non-completed)"
                value={String(overall?.incompleteInstall)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Repairs (Completed)"
                value={String(overall?.completedRepair)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Repairs (Non-completed)"
                value={String(overall?.incompleteRepair)}
              />
            </View>
            <View style={tw`h-3`} />

            <View style={tw`flex-row`}>
              <StatBox
                label="Other (Completed)"
                value={String(overall?.completedOther)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Other (Non-completed)"
                value={String(overall?.incompleteOther)}
              />
            </View>
            <View style={tw`h-3`} />

            {/* Optional: Not Completed */}
          </View>

          <Section title="Notes">
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              All of the statistics are collected and calculated based on your
              business records and data.
            </Text>
          </Section>
        </ScrollView>
      ) : driversLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
          <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
            Loading driver analytics…
          </Text>
        </View>
      ) : (
        // Drivers accordion
        <FlatList
          data={driverRows}
          keyExtractor={(item, idx) =>
            String(getEmployeeId(item.employee) ?? idx)
          }
          contentContainerStyle={tw`px-4 pb-24 mt-3`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
          renderItem={({ item }) => {
            const e = item.employee;
            const id = item.employee.id;
            const name =
              item.employee.profile?.first_name +
              ' ' +
              item.employee.profile?.last_name;
            const open = expandedDriverId === id;

            return (
              <View
                style={[
                  tw`mb-2 rounded-2xl overflow-hidden`,
                  { backgroundColor: colors.card },
                ]}
              >
                {/* Header */}
                <TouchableOpacity
                  onPress={() => setExpandedDriverId(open ? null : id)}
                  style={tw`px-3 py-3 flex-row items-center justify-between`}
                >
                  <View style={tw`flex-1`}>
                    <Text
                      style={[
                        tw`text-base font-semibold`,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}
                    >
                      {item.totalStops} stops •{' '}
                      {pct(item.completedStops, item.totalStops)}
                    </Text>
                  </View>
                  {open ? (
                    <ChevronDown width={18} height={18} color={colors.text} />
                  ) : (
                    <ChevronRight width={18} height={18} color={colors.text} />
                  )}
                </TouchableOpacity>

                {/* Body */}
                {open && (
                  <View style={tw`px-3 pb-3`}>
                    <View>
                      <Text
                        style={[
                          tw`text-sm font-semibold mb-2`,
                          { color: colors.text },
                        ]}
                      >
                        Routes & Stops
                      </Text>
                    </View>
                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Routes (Total)"
                        value={String(overall?.totalRoutes ?? 0)}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Stops (Total)"
                        value={String(overall?.totalStops ?? 0)}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Routes (Completed)"
                        value={String(overall?.completedRoutes ?? 0)}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Stops (Completed)"
                        value={String(overall?.completedStops ?? 0)}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Routes (Not Completed)"
                        value={String(overall?.notCompletedRoutes ?? 0)}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Stops (Not Completed)"
                        value={String(overall?.notCompletedStops ?? 0)}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Routes (Draft)"
                        value={String(overall?.draftRoutes ?? 0)}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Stops (Scheduled)"
                        value={String(overall?.scheduledStops ?? 0)}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View>
                      <Text
                        style={[
                          tw`text-sm font-semibold mb-2`,
                          { color: colors.text },
                        ]}
                      >
                        Financial Summary
                      </Text>
                    </View>

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collection (Expected)"
                        value={currencyFmt(overall?.collectedExpected ?? 0)}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Payment (Expected)"
                        value={currencyFmt(overall?.paidOutExpected)}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collected (Exact)"
                        value={currencyFmt(
                          overall?.totalAmountExpectedPaidOut ?? 0,
                        )}
                      />
                      <View style={tw`w-2`} />
                      <SmallStat
                        label="Paid (Exact)"
                        value={currencyFmt(
                          overall?.totalAmountPaidOutMissing ?? 0,
                        )}
                      />
                    </View>

                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collection (Remaining)"
                        value={currencyFmt(overall?.collectedMissing)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Payment (Remaining)"
                        value={currencyFmt(overall?.paidOutMissing)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collection (Avg / Stop)"
                        value={currencyFmt(overall?.avgStopCollected)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Payment (Avg / Stop)"
                        value={currencyFmt(overall?.avgStopPaidOut)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collection (Completed Stops)"
                        value={currencyFmt(overall?.collectCompleted)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Payment (Completed Stops)"
                        value={currencyFmt(overall?.paidOutCompleted)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Collection (Non-completed Stops)"
                        value={currencyFmt(overall?.collectCompleted)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Payment (Non-completed Stops)"
                        value={currencyFmt(overall?.paidOutCompleted)}
                      />
                    </View>
                    <View style={tw`h-2`} />
                    <View>
                      <Text
                        style={[
                          tw`text-sm font-semibold mb-2`,
                          { color: colors.text },
                        ]}
                      >
                        Stop Type Summary
                      </Text>
                    </View>

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Deliveries (Completed)"
                        value={String(overall?.completedDeliveries)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Deliveries (Non-completed)"
                        value={String(overall?.incompleteDeliveries)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Pickups (Completed)"
                        value={String(overall?.completedPickups)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Pickups (Non-completed)"
                        value={String(overall?.incompletePickups)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Services (Completed)"
                        value={String(overall?.completedService)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Services (Non-completed)"
                        value={String(overall?.incompleteService)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Installations (Completed)"
                        value={String(overall?.completedInstall)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Installations (Non-completed)"
                        value={String(overall?.incompleteInstall)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Repairs (Completed)"
                        value={String(overall?.completedRepair)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Repairs (Non-completed)"
                        value={String(overall?.incompleteRepair)}
                      />
                    </View>
                    <View style={tw`h-2`} />

                    <View style={tw`flex-row`}>
                      <SmallStat
                        label="Other (Completed)"
                        value={String(overall?.completedOther)}
                      />
                      <View style={tw`w-3`} />
                      <SmallStat
                        label="Other (Non-completed)"
                        value={String(overall?.incompleteOther)}
                      />
                    </View>
                    <View style={tw`h-2`} />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={tw`flex-1 items-center justify-center mt-8`}>
              <Text style={[tw`text-xs`, { color: colors.muted }]}>
                No drivers found in this range.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
