// src/app/routes/RouteAnalyticsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import { ChevronLeft, ChevronsLeft } from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';

// --- helpers
const money = (cents?: number, ccy = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(
    (cents || 0) / 100,
  );
const pct = (v?: number) => `${Math.round((v || 0) * 100)}%`;
const hhmm = (sec?: number) => {
  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

// --- mock fetch (swap with API call)
function useMockAnalytics(period: 'today' | '7d' | '30d') {
  const [loading, setLoading] = useState(false);
  const data = useMemo(() => {
    // change numbers slightly per period for realism
    const mult = period === 'today' ? 1 : period === '7d' ? 5 : 20;
    return {
      totals: {
        stops_scheduled: 30 * mult,
        stops_completed: 27 * mult,
        on_time_rate: 0.87,
        avg_dwell_sec: 520,
        revenue_expected_cents: 420000 * mult,
        revenue_collected_cents: 395000 * mult,
      },
      by_stop_type: [
        { type: 'pickup', scheduled: 16 * mult, completed: 15 * mult },
        { type: 'delivery', scheduled: 14 * mult, completed: 12 * mult },
      ],
      by_driver: [
        {
          name: 'Alex Moore',
          stops_completed: 11 * mult,
          on_time_rate: 0.91,
          hours_worked_sec: 7.2 * 3600 * mult,
          revenue_collected_cents: 82000 * mult,
        },
        {
          name: 'Sam Patel',
          stops_completed: 9 * mult,
          on_time_rate: 0.86,
          hours_worked_sec: 6.5 * 3600 * mult,
          revenue_collected_cents: 66000 * mult,
        },
        {
          name: 'Riley Chen',
          stops_completed: 7 * mult,
          on_time_rate: 0.82,
          hours_worked_sec: 6.1 * 3600 * mult,
          revenue_collected_cents: 52000 * mult,
        },
      ],
      issues: {
        late_arrivals: 3 * mult,
        long_dwell: 2 * mult,
        driver_offline: 1 * mult,
        payment_missing: 1 * mult,
        payment_mismatch: 0,
      },
    };
  }, [period]);
  return { loading, data };
}

// simple bar
function Bar({
  value,
  max,
  colors,
}: {
  value: number;
  max: number;
  colors: any;
}) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={[tw`h-2 rounded`, { backgroundColor: colors.border }]}>
      <View
        style={[
          tw`h-2 rounded`,
          {
            width: `${w}%`,
            backgroundColor: colors.brand?.primary || '#2563eb',
          },
        ]}
      />
    </View>
  );
}

export default function RouteAnalyticsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const { loading, data } = useMockAnalytics(period);

  const revGap =
    data.totals.revenue_expected_cents - data.totals.revenue_collected_cents;

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-3 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()} style={tw`mr-2`}>
          <ChevronLeft width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold`, { color: colors.text }]}>
          Analytics
        </Text>
        <View style={tw`flex-1`} />
      </View>

      {/* Period switcher */}
      <View style={tw`px-4 mb-8`}>
        <View
          style={[
            tw`flex-row p-1 rounded-xl`,
            { backgroundColor: colors.border },
          ]}
        >
          {(['today', '7d', '30d'] as const).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                tw`flex-1 px-3 py-2 rounded-lg items-center`,
                {
                  backgroundColor:
                    period === p
                      ? colors.brand?.primary || '#2563eb'
                      : 'transparent',
                },
              ]}
            >
              <Text style={{ color: period === p ? '#fff' : colors.text }}>
                {p === 'today'
                  ? 'Today'
                  : p === '7d'
                  ? 'Last 7 days'
                  : 'Last 30 days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
          <Text style={[tw`mt-2`, { color: colors.muted }]}>
            Loading analytics…
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={tw`px-4 pb-20`}>
          {/* KPI Grid */}
          <View style={tw`grid grid-cols-2 gap-3`}>
            <KpiCard
              colors={colors}
              label="Stops Completed"
              value={`${data.totals.stops_completed} / ${data.totals.stops_scheduled}`}
            />
            <KpiCard
              colors={colors}
              label="On-time Rate"
              value={pct(data.totals.on_time_rate)}
            />
            <KpiCard
              colors={colors}
              label="Collected"
              value={money(data.totals.revenue_collected_cents)}
            />
            <KpiCard
              colors={colors}
              label="Expected"
              value={money(data.totals.revenue_expected_cents)}
              sub={revGap > 0 ? `-${money(revGap)} gap` : 'On target'}
            />
            <KpiCard
              colors={colors}
              label="Avg Dwell"
              value={hhmm(data.totals.avg_dwell_sec)}
            />
          </View>

          {/* Stops by type */}
          <SectionTitle colors={colors} title="Stops by Type" />
          <View
            style={[
              tw`rounded-2xl p-3 mb-3`,
              { backgroundColor: colors.borderSecondary },
            ]}
          >
            {data.by_stop_type.map((t, i) => {
              const mx = Math.max(...data.by_stop_type.map(x => x.completed));
              return (
                <View key={i} style={[tw`mb-3`]}>
                  <View style={tw`flex-row justify-between mb-1`}>
                    <Text style={{ color: colors.text }}>{t.type}</Text>
                    <Text style={{ color: colors.muted }}>
                      {t.completed}/{t.scheduled}
                    </Text>
                  </View>
                  <Bar value={t.completed} max={mx} colors={colors} />
                </View>
              );
            })}
          </View>

          {/* Driver summary */}
          <SectionTitle colors={colors} title="Drivers (summary)" />
          <View
            style={[
              tw`rounded-2xl mb-3`,
              { backgroundColor: colors.borderSecondary },
            ]}
          >
            {data.by_driver.map((d, i) => (
              <View
                key={i}
                style={[
                  tw`px-3 py-3`,
                  i > 0 && { borderTopWidth: 1, borderColor: colors.border },
                ]}
              >
                <View style={tw`flex-row justify-between items-center`}>
                  <Text style={[tw`font-semibold`, { color: colors.text }]}>
                    {d.name}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {pct(d.on_time_rate)}
                  </Text>
                </View>
                <View style={tw`flex-row justify-between mt-1`}>
                  <Text style={{ color: colors.muted }}>Stops</Text>
                  <Text style={{ color: colors.text }}>
                    {d.stops_completed}
                  </Text>
                </View>
                <View style={tw`flex-row justify-between mt-1`}>
                  <Text style={{ color: colors.muted }}>Hours</Text>
                  <Text style={{ color: colors.text }}>
                    {hhmm(d.hours_worked_sec)}
                  </Text>
                </View>
                <View style={tw`flex-row justify-between mt-1`}>
                  <Text style={{ color: colors.muted }}>Collected</Text>
                  <Text style={{ color: colors.text }}>
                    {money(d.revenue_collected_cents)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Issues */}
          <SectionTitle colors={colors} title="Issues" />
          <View style={[tw`flex-row flex-wrap -mx-1 mb-8`]}>
            {[
              { k: 'Late arrivals', v: data.issues.late_arrivals },
              { k: 'Long dwell', v: data.issues.long_dwell },
              { k: 'Driver offline', v: data.issues.driver_offline },
              { k: 'Payment missing', v: data.issues.payment_missing },
              { k: 'Payment mismatch', v: data.issues.payment_mismatch },
            ].map((it, i) => (
              <View key={i} style={[tw`w-1/2 px-1 mb-2`]}>
                <View
                  style={[
                    tw`rounded-2xl p-3`,
                    { backgroundColor: colors.borderSecondary },
                  ]}
                >
                  <Text style={{ color: colors.muted }}>{it.k}</Text>
                  <Text
                    style={[tw`text-xl font-semibold`, { color: colors.text }]}
                  >
                    {it.v}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function KpiCard({
  colors,
  label,
  value,
  sub,
}: {
  colors: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View
      style={[
        tw`rounded-2xl p-3 mb-3`,
        { backgroundColor: colors.borderSecondary },
      ]}
    >
      <Text style={[tw`text-xs`, { color: colors.muted }]}>{label}</Text>
      <Text style={[tw`text-xl font-semibold mt-1`, { color: colors.text }]}>
        {value}
      </Text>
      {!!sub && (
        <Text style={[tw`text-2xs mt-1`, { color: colors.muted }]}>{sub}</Text>
      )}
    </View>
  );
}
function SectionTitle({ colors, title }: { colors: any; title: string }) {
  return (
    <Text
      style={[tw`text-base font-semibold mb-2 mt-3`, { color: colors.text }]}
    >
      {title}
    </Text>
  );
}
