// src/app/analytics/AnalyticsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ArrowLeft, RefreshCcw } from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { supabase } from '../../shared/lib/supabase';

type RangeKey = '1' | '7' | '30';
type TabKey = 'overall' | 'drivers';

type StopRow = {
  id: number;
  business_id: number;
  route_id: number;
  driver_id: number | null; // profile.id
  employee_id: number | null;
  status: string; // planned / completed / failed / …
  created_at: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  details: any; // jsonb
  proof: any; // jsonb
};

type DriverAgg = {
  driver_id: number | null;
  name?: string; // optional if you later join profile
  totalStops: number;
  completedStops: number;
  conversionPct: number;
  expectedCents: number;
  collectedCents: number;
  missingCents: number;
};

export default function AnalyticsScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  const [tab, setTab] = useState<TabKey>('overall');
  const [rangeKey, setRangeKey] = useState<RangeKey>('1');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<StopRow[]>([]);

  const { startISO, endISO, label } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    if (rangeKey === '1') {
      start.setHours(0, 0, 0, 0);
    } else if (rangeKey === '7') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      label:
        rangeKey === '1'
          ? 'Today'
          : rangeKey === '7'
          ? 'Past 7 Days'
          : 'Past 30 Days',
    };
  }, [rangeKey]);

  // money helpers
  const currencyFmt = (cents: number | null | undefined) => {
    const n = typeof cents === 'number' ? cents : 0;
    const dollars = n / 100;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(dollars);
    } catch {
      return `$${dollars.toFixed(2)}`;
    }
  };

  // Extractors: handle various potential key names in JSON
  const intFrom = (v: any): number => {
    if (v == null) return 0;
    if (typeof v === 'number') return Math.round(v);
    const parsed = parseInt(String(v), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Attempts multiple keys that you might have used in your JSON
  const getExpectedCents = (row: StopRow) => {
    const d = row.details || {};
    return (
      intFrom(d.expected_amount_cents) ||
      intFrom(d.expected_total_cents) ||
      intFrom(d.expectedCents) ||
      0
    );
  };
  const getCollectedCents = (row: StopRow) => {
    // could live in proof or details depending on workflow
    const p = row.proof || {};
    const d = row.details || {};
    return (
      intFrom(p.collected_amount_cents) ||
      intFrom(p.payment_collected_cents) ||
      intFrom(d.collected_amount_cents) ||
      intFrom(d.collectedCents) ||
      0
    );
  };
  const getPayoutCents = (row: StopRow) => {
    const d = row.details || {};
    return intFrom(d.payout_cents) || intFrom(d.paid_out_cents) || 0;
  };

  // Completed?
  const isCompleted = (row: StopRow) => {
    const s = (row.status || '').toLowerCase();
    if (s === 'completed' || s === 'done' || s === 'delivered') return true;
    // fallback if status is unreliable:
    if (row.departed_at || row.arrived_at) return true;
    return false;
  };

  const fetchStops = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      // Primary filter by time_window_start when available (what was “set for [day]”)
      // Fallback query by created_at if time_window_start is null.
      // We do two pulls and merge client-side to keep the filter simple.
      const [q1, q2] = await Promise.all([
        supabase
          .from('stops')
          .select(
            'id,business_id,route_id,driver_id,employee_id,status,created_at,time_window_start,time_window_end,arrived_at,departed_at,details,proof',
          )
          .eq('business_id', business.id)
          .gte('time_window_start', startISO)
          .lte('time_window_start', endISO),
        supabase
          .from('stops')
          .select(
            'id,business_id,route_id,driver_id,employee_id,status,created_at,time_window_start,time_window_end,arrived_at,departed_at,details,proof',
          )
          .eq('business_id', business.id)
          .is('time_window_start', null)
          .gte('created_at', startISO)
          .lte('created_at', endISO),
      ]);

      const data1 = Array.isArray(q1.data) ? q1.data : [];
      const data2 = Array.isArray(q2.data) ? q2.data : [];
      // merge unique by id
      const map = new Map<number, StopRow>();
      [...data1, ...data2].forEach((r: any) => map.set(r.id, r as StopRow));
      setRows(Array.from(map.values()));
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [business?.id, startISO, endISO]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStops();
    setRefreshing(false);
  }, [fetchStops]);

  useEffect(() => {
    fetchStops();
  }, [fetchStops]);

  // ─── Aggregations ─────────────────────────────────────────────────────────────
  const overall = useMemo(() => {
    const totalStops = rows.length;
    const completedStops = rows.filter(isCompleted).length;

    const expectedCents = rows.reduce((sum, r) => sum + getExpectedCents(r), 0);
    const collectedCents = rows.reduce(
      (sum, r) => sum + getCollectedCents(r),
      0,
    );
    const missingCents = Math.max(0, expectedCents - collectedCents);
    const paidOutCents = rows.reduce((sum, r) => sum + getPayoutCents(r), 0);

    const conversionPct = totalStops
      ? Math.round((completedStops / totalStops) * 100)
      : 0;

    // Extra useful tidbits
    const failedStops = rows.filter(
      r => (r.status || '').toLowerCase() === 'failed',
    ).length;
    const avgPerStopCents = totalStops
      ? Math.round(expectedCents / totalStops)
      : 0;

    return {
      totalStops,
      completedStops,
      failedStops,
      conversionPct,
      expectedCents,
      collectedCents,
      missingCents,
      paidOutCents,
      avgPerStopCents,
    };
  }, [rows]);

  const byDriver: DriverAgg[] = useMemo(() => {
    const map = new Map<number | null, DriverAgg>();
    for (const r of rows) {
      const key = r.driver_id ?? null;
      if (!map.has(key)) {
        map.set(key, {
          driver_id: key,
          totalStops: 0,
          completedStops: 0,
          conversionPct: 0,
          expectedCents: 0,
          collectedCents: 0,
          missingCents: 0,
        });
      }
      const agg = map.get(key)!;
      agg.totalStops += 1;
      if (isCompleted(r)) agg.completedStops += 1;
      agg.expectedCents += getExpectedCents(r);
      agg.collectedCents += getCollectedCents(r);
    }
    // finalize
    map.forEach(agg => {
      agg.missingCents = Math.max(0, agg.expectedCents - agg.collectedCents);
      agg.conversionPct = agg.totalStops
        ? Math.round((agg.completedStops / agg.totalStops) * 100)
        : 0;
    });
    // sort: most stops first
    return Array.from(map.values()).sort((a, b) => b.totalStops - a.totalStops);
  }, [rows]);

  // ─── UI bits ─────────────────────────────────────────────────────────────────
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
        { backgroundColor: colors.main },
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
                { backgroundColor: colors.border },
              ]}
            >
              <ArrowLeft width={18} height={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
              Analytics
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={[tw`p-2 rounded-lg`, { backgroundColor: colors.border }]}
          >
            <RefreshCcw width={16} height={16} color={colors.text} />
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
        <View style={tw`flex-row bg-black/20 rounded-xl`}>
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
      {loading ? (
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
            <View style={tw`flex-row`}>
              <StatBox
                label="Stops (Total)"
                value={String(overall.totalStops)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Completed"
                value={String(overall.completedStops)}
                sub={`${overall.conversionPct}% conv.`}
              />
            </View>
            <View style={tw`h-3`} />
            <View style={tw`flex-row`}>
              <StatBox
                label="Expected"
                value={currencyFmt(overall.expectedCents)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Collected"
                value={currencyFmt(overall.collectedCents)}
              />
            </View>
            <View style={tw`h-3`} />
            <View style={tw`flex-row`}>
              <StatBox
                label="Missing"
                value={currencyFmt(overall.missingCents)}
              />
              <View style={tw`w-3`} />
              <StatBox
                label="Paid Out"
                value={currencyFmt(overall.paidOutCents)}
              />
            </View>
            <View style={tw`h-3`} />
            <View style={tw`flex-row`}>
              <StatBox
                label="Avg / Stop"
                value={currencyFmt(overall.avgPerStopCents)}
              />
              <View style={tw`w-3`} />
              <StatBox label="Failed" value={String(overall.failedStops)} />
            </View>
          </View>

          <Section title="Notes">
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              “Expected”/“Collected”/“Paid Out” read from JSON in{' '}
              <Text style={{ fontWeight: '600' }}>stops.details</Text> /
              <Text style={{ fontWeight: '600' }}>stops.proof</Text> (e.g.{' '}
              <Text style={{ fontStyle: 'italic' }}>expected_amount_cents</Text>
              ,{' '}
              <Text style={{ fontStyle: 'italic' }}>
                collected_amount_cents
              </Text>
              , <Text style={{ fontStyle: 'italic' }}>payout_cents</Text>). If
              your keys differ, adjust the extractors at the top.
            </Text>
          </Section>
        </ScrollView>
      ) : (
        <View style={tw`flex-1 mt-4`}>
          <View style={tw`px-4 mb-2`}>
            <Text style={[tw`text-lg font-semibold`, { color: colors.text }]}>
              Drivers
            </Text>
            <Text style={[tw`text-2xs`, { color: colors.muted }]}>
              Sorted by total stops in range.
            </Text>
          </View>

          <FlatList
            data={byDriver}
            keyExtractor={(i, idx) => `${i.driver_id ?? 'none'}-${idx}`}
            contentContainerStyle={tw`px-4 pb-24`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text}
              />
            }
            renderItem={({ item }) => (
              <View
                style={[
                  tw`mb-2 px-3 py-3 rounded-xl`,
                  { backgroundColor: colors.main },
                ]}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <Text
                    style={[
                      tw`text-base font-semibold`,
                      { color: colors.text },
                    ]}
                  >
                    {item.driver_id ?? 'Unassigned'}
                  </Text>
                  <Text style={[tw`text-2xs`, { color: colors.muted }]}>
                    {item.conversionPct}% conv.
                  </Text>
                </View>

                <View style={tw`flex-row mt-2`}>
                  <SmallStat
                    label="Total"
                    value={String(item.totalStops)}
                    colors={colors}
                  />
                  <View style={tw`w-2`} />
                  <SmallStat
                    label="Completed"
                    value={String(item.completedStops)}
                    colors={colors}
                  />
                  <View style={tw`w-2`} />
                  <SmallStat
                    label="Expected"
                    value={currencyFmt(item.expectedCents)}
                    colors={colors}
                  />
                </View>
                <View style={tw`flex-row mt-2`}>
                  <SmallStat
                    label="Collected"
                    value={currencyFmt(item.collectedCents)}
                    colors={colors}
                  />
                  <View style={tw`w-2`} />
                  <SmallStat
                    label="Missing"
                    value={currencyFmt(item.missingCents)}
                    colors={colors}
                  />
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={tw`flex-1 items-center justify-center mt-8`}>
                <Text style={[tw`text-xs`, { color: colors.muted }]}>
                  No stops in this range.
                </Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
}

function SmallStat({
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
}
