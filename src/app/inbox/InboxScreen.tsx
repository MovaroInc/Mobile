// src/app/inbox/InboxScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import tw from 'twrnc';
import {
  Bell,
  AlertTriangle,
  ChevronsRight,
  CheckCircle,
  Clock,
  User,
  DollarSign,
  Truck,
  Package,
  Filter as FilterIcon,
  X as Close,
} from 'react-native-feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { GetInboxByBusinessId } from '../../shared/lib/inboxHelpers';

// ───────────────── types ─────────────────
type Severity = 'low' | 'medium' | 'high';
type Kind =
  | 'exception'
  | 'dispatch'
  | 'driver'
  | 'billing'
  | 'people'
  | 'system';

type InboxItem = {
  id: string;
  kind: Kind;
  severity: Severity;
  title: string;
  subtitle?: string;
  created_at: string; // ISO
  read: boolean;
  route_id?: number;
  stop_id?: number;
  driver_id?: number;
};

// ───────────────── helpers ─────────────────
const timeAgo = (iso: string) => {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hr ago';
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const kindLabel: Record<Kind, string> = {
  exception: 'Exceptions',
  dispatch: 'Dispatch',
  driver: 'Drivers',
  billing: 'Billing',
  people: 'People',
  system: 'System',
};

function toKind(type?: string): Kind {
  if (!type) return 'system';
  if (type.startsWith('stop.')) return 'exception';
  if (type.startsWith('dispatch.') || type.startsWith('route.'))
    return 'dispatch';
  if (type.startsWith('driver.')) return 'driver';
  if (type.startsWith('billing.')) return 'billing';
  if (
    type.startsWith('invite.') ||
    type.startsWith('people.') ||
    type.startsWith('user.')
  )
    return 'people';
  return 'system';
}

function toSeverity(sev?: string): Severity {
  const s = String(sev || '').toLowerCase();
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  return 'low';
}

function iconFor(kind: Kind, color: string) {
  const P = 16;
  switch (kind) {
    case 'exception':
      return <AlertTriangle width={P} height={P} color={color} />;
    case 'dispatch':
      return <Package width={P} height={P} color={color} />;
    case 'driver':
      return <Truck width={P} height={P} color={color} />;
    case 'billing':
      return <DollarSign width={P} height={P} color={color} />;
    case 'people':
      return <User width={P} height={P} color={color} />;
    case 'system':
      return <Bell width={P} height={P} color={color} />;
  }
}

function severityColors(sev: Severity) {
  switch (sev) {
    case 'high':
      return { bg: 'rgba(239,68,68,0.12)', dot: '#EF4444' }; // red
    case 'medium':
      return { bg: 'rgba(245,158,11,0.14)', dot: '#F59E0B' }; // amber
    default:
      return { bg: 'rgba(2,132,199,0.10)', dot: '#0284C7' }; // sky
  }
}

// Map any server row (event + optional user fields) → UI shape
function mapRowToItem(row: any): InboxItem {
  // supports both flat event rows and joined structures (event + user)
  const event = row.event || row;
  const user = row.user || row; // when joined, read_at often lives here
  return {
    id: String(event.id || row.id),
    kind: toKind(event.type),
    severity: toSeverity(event.severity),
    title: event.title || '(no title)',
    subtitle: event.body || undefined,
    created_at: event.created_at || new Date().toISOString(),
    read: Boolean(user.read_at || row.read_at), // default false if API has no user state
    route_id: event.route_id ?? undefined,
    stop_id: event.stop_id ?? undefined,
    driver_id:
      event.driver_profile_id ??
      event.driver_id ??
      row.driver_profile_id ??
      undefined,
  };
}

// ───────────────── screen ─────────────────
export default function InboxScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'today' | 'critical' | 'driver' | 'billing'
  >('all');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    if (!business?.id) return;
    setRefreshing(true);
    try {
      const res = await GetInboxByBusinessId(business.id);
      if (!res?.success)
        throw new Error(res?.message || 'Failed to load inbox');
      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows.map(mapRowToItem);
      // newest first
      mapped.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setItems(mapped);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load inbox.');
    } finally {
      setRefreshing(false);
    }
  }, [business?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    load();
  }, [load]);

  const markAllRead = useCallback(() => {
    // TODO: hit your API to mark-all-read for this business/profile
    setItems(prev => prev.map(x => ({ ...x, read: true })));
  }, []);

  const handleResolve = useCallback((id: string) => {
    // TODO: POST /inbox/:eventId/resolve { resolution_state: 'resolved' }
    setItems(prev => prev.map(x => (x.id === id ? { ...x, read: true } : x)));
    Alert.alert('Resolved', 'This item has been marked as resolved.');
  }, []);

  const handleSnooze = useCallback((id: string) => {
    // TODO: POST /inbox/:eventId/snooze { until: ... }
    setItems(prev => prev.map(x => (x.id === id ? { ...x, read: true } : x)));
    Alert.alert(
      'Snoozed',
      'This item will reappear if the condition persists.',
    );
  }, []);

  const handleOpen = useCallback(
    (it: InboxItem) => {
      if (it.driver_id) {
        nav.navigate('DriverProfile', { driverId: it.driver_id });
      } else if (it.stop_id) {
        nav.navigate('StopDetails', {
          stopId: it.stop_id,
          routeId: it.route_id,
        });
      } else if (it.route_id) {
        nav.navigate('RouteDetails', { routeId: it.route_id });
      } else if (it.kind === 'billing') {
        nav.navigate('ManageSubscription');
      } else {
        Alert.alert('Open', 'Navigate to the relevant screen.');
      }
      // TODO: PATCH /inbox/:eventId/read
      setItems(prev =>
        prev.map(x => (x.id === it.id ? { ...x, read: true } : x)),
      );
    },
    [nav],
  );

  const counts = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cAll = items.length;
    const cToday = items.filter(
      x => new Date(x.created_at) >= todayStart,
    ).length;
    const cCritical = items.filter(x => x.severity === 'high').length;
    const cDriver = items.filter(x => x.kind === 'driver').length;
    const cBilling = items.filter(x => x.kind === 'billing').length;
    return { cAll, cToday, cCritical, cDriver, cBilling };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return items
      .filter(it => {
        if (unreadOnly && it.read) return false;
        if (filter === 'today') {
          if (new Date(it.created_at) < todayStart) return false;
        } else if (filter === 'critical') {
          if (it.severity !== 'high') return false;
        } else if (filter === 'driver') {
          if (it.kind !== 'driver') return false;
        } else if (filter === 'billing') {
          if (it.kind !== 'billing') return false;
        }
        if (!q) return true;
        const blob = [it.title, it.subtitle, kindLabel[it.kind]]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [items, query, filter, unreadOnly]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <View style={tw`flex-row items-center justify-between`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            Inbox
          </Text>
          <TouchableOpacity
            onPress={markAllRead}
            style={[
              tw`px-3 py-1.5 rounded-xl`,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>Mark all read</Text>
          </TouchableOpacity>
        </View>
        <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
          Live alerts, exceptions, and billing updates.
        </Text>
      </View>

      {/* Search */}
      <View style={tw`px-4`}>
        <View
          style={[
            tw`flex-row items-center px-3 py-2 rounded-2xl`,
            { backgroundColor: colors.border },
          ]}
        >
          <FilterIcon width={16} height={16} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search alerts…"
            placeholderTextColor="#9CA3AF"
            style={[tw`ml-2 flex-1`, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Close width={16} height={16} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <View style={tw`px-4 mt-2 mb-2`}>
        <View style={tw`flex-row flex-wrap`}>
          <Chip
            label={`All (${counts.cAll})`}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
            colors={colors}
          />
          <Chip
            label={`Today (${counts.cToday})`}
            active={filter === 'today'}
            onPress={() => setFilter('today')}
            colors={colors}
          />
          <Chip
            label={`Critical (${counts.cCritical})`}
            active={filter === 'critical'}
            onPress={() => setFilter('critical')}
            colors={colors}
          />
          <Chip
            label={`Drivers (${counts.cDriver})`}
            active={filter === 'driver'}
            onPress={() => setFilter('driver')}
            colors={colors}
          />
          <Chip
            label={`Billing (${counts.cBilling})`}
            active={filter === 'billing'}
            onPress={() => setFilter('billing')}
            colors={colors}
          />
          <TogglePill
            label="Unread only"
            active={unreadOnly}
            onPress={() => setUnreadOnly(v => !v)}
            colors={colors}
          />
        </View>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-8`}>
          <Bell width={22} height={22} color={colors.muted} />
          <Text
            style={[tw`text-lg font-semibold mt-2`, { color: colors.text }]}
          >
            No alerts
          </Text>
          <Text style={[tw`text-xs mt-1 text-center`, { color: colors.muted }]}>
            Everything looks good. New items will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={tw`px-4 pb-8`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
          renderItem={({ item }) => (
            <InboxRow
              item={item}
              colors={colors}
              onOpen={() => handleOpen(item)}
              onResolve={() => handleResolve(item.id)}
              onSnooze={() => handleSnooze(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

// ───────────────── row component ─────────────────
function InboxRow({
  item,
  colors,
  onOpen,
  onResolve,
  onSnooze,
}: {
  item: InboxItem;
  colors: any;
  onOpen: () => void;
  onResolve: () => void;
  onSnooze: () => void;
}) {
  const sev = severityColors(item.severity);
  const dot = (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: item.read ? colors.muted : sev.dot,
        marginRight: 8,
        marginTop: 2,
      }}
    />
  );

  const leftIconColor = item.read ? colors.muted : sev.dot;

  return (
    <View
      style={[
        tw`rounded-2xl mb-2 p-3`,
        {
          backgroundColor: colors.main,
          borderColor: colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <View style={tw`flex-row`}>
        {/* Icon + dot */}
        <View
          style={[
            tw`w-10 h-10 rounded-xl items-center justify-center mr-3`,
            { backgroundColor: sev.bg },
          ]}
        >
          {iconFor(item.kind, leftIconColor)}
        </View>

        {/* Text */}
        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-start`}>
            {dot}
            <Text
              style={[tw`flex-1 text-sm font-semibold`, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>

          {!!item.subtitle && (
            <Text
              style={[tw`text-xs mt-1`, { color: colors.muted }]}
              numberOfLines={2}
            >
              {item.subtitle}
            </Text>
          )}

          <View style={tw`flex-row items-center mt-2`}>
            <Clock width={12} height={12} color={colors.muted} />
            <Text style={[tw`text-2xs ml-1`, { color: colors.muted }]}>
              {timeAgo(item.created_at)}
            </Text>
          </View>

          {/* Actions */}
          <View style={tw`flex-row mt-2`}>
            <SmallBtn
              label="Open"
              onPress={onOpen}
              colors={colors}
              Left={<ChevronsRight width={14} height={14} color="#fff" />}
              primary
            />
            <SmallBtn
              label="Resolve"
              onPress={onResolve}
              colors={colors}
              Left={<CheckCircle width={14} height={14} color={colors.text} />}
            />
            <SmallBtn label="Snooze" onPress={onSnooze} colors={colors} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ───────────────── UI atoms ─────────────────
function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-1.5 rounded-lg mr-2 mb-2`,
        {
          backgroundColor: active
            ? colors.brand?.primary || '#2563eb'
            : colors.border,
        },
      ]}
    >
      <Text
        style={[
          tw`text-xs font-semibold`,
          { color: active ? '#fff' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TogglePill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-1.5 rounded-lg mr-2 mb-2`,
        {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: active
            ? colors.brand?.primary || '#2563eb'
            : colors.border,
        },
      ]}
    >
      <Text
        style={[
          tw`text-xs font-semibold`,
          { color: active ? colors.brand?.primary || '#2563eb' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SmallBtn({
  label,
  onPress,
  colors,
  Left,
  primary,
}: {
  label: string;
  onPress: () => void;
  colors: any;
  Left?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-1.5 rounded-xl mr-2 flex-row items-center`,
        {
          backgroundColor: primary
            ? colors.brand?.primary || '#2563eb'
            : colors.border,
        },
      ]}
    >
      {Left ? <View style={tw`mr-1`}>{Left}</View> : null}
      <Text
        style={[
          tw`text-xs font-semibold`,
          { color: primary ? '#fff' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
