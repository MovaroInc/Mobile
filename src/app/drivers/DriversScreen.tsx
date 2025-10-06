// src/app/drivers/DriversScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import tw from 'twrnc';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Map as MapIcon,
  List as ListIcon,
  MoreVertical,
  Phone,
  Search as SearchIcon,
  RefreshCcw,
  PlusCircle,
} from 'react-native-feather';

import Clipboard from '@react-native-clipboard/clipboard';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';
import { getDrivers } from '../../shared/lib/DriversHelpers';
import { getInviteByBusinessId } from '../../shared/lib/InviteHelpers';

// ✅ Mapbox
import MapboxGL from '@rnmapbox/maps';
import { emitInboxEvent } from '../../shared/lib/inboxHelpers';
MapboxGL.setAccessToken(
  'pk.eyJ1IjoibW92YWwiLCJhIjoiY21jZTJ1cnJrMDc3dTJrcHBwZzMyd2dhdSJ9.DFSiGfHa19L8vMK7muIr8A',
);

/* ───────────────── types ───────────────── */

type DriverStatus = 'on_route' | 'available' | 'off_duty' | 'pending';
type Driver = {
  id: number;
  // unified fields (your API may return Profile/availability etc.)
  name?: string;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;

  status?: DriverStatus;
  availability?: DriverStatus;

  Profile?: {
    first_name?: string;
    last_name?: string;
  };
  job_title?: string | null;
  employment?: string | null;

  last_seen_at?: string | null; // ISO
  route_name?: string | null;
  next_eta?: string | null; // "12:45 PM"
  lat?: number | null;
  lng?: number | null;
  battery?: number | null;
};

type InviteStatus =
  | 'pending'
  | 'sent'
  | 'claimed'
  | 'completed'
  | 'declined'
  | 'revoked'
  | 'expired';

type Invite = {
  id: number;
  created_at: string;
  business_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  invited_email: string | null;
  invited_phone: string | null;
  invited_role: 'driver';
  reference_code: string | null;
  token_expires_at: string | null;
  status: InviteStatus;
  sent_at: string | null;
};

type ViewMode = 'list' | 'map';
type Tab = 'drivers' | 'invites';

/* ───────────────── screen ───────────────── */

export default function DriversScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();

  // Tabs
  const [tab, setTab] = useState<Tab>('drivers');

  // Drivers
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionDriver, setActionDriver] = useState<Driver | null>(null);

  // Invites
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteRefreshing, setInviteRefreshing] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteFilter, setInviteFilter] = useState<InviteStatus | 'all'>(
    'pending',
  );

  /* ─────────────── fetchers ─────────────── */

  const fetchDrivers = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const res = await getDrivers(business.id);
      setDrivers(res.data ?? []);
    } catch {
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  const fetchInvites = useCallback(async () => {
    console.log('fetchInvites');
    if (!business?.id) return;
    console.log('business?.id', business?.id);
    setLoadingInvites(true);
    try {
      const all = (await getInviteByBusinessId(business.id)) ?? [];
      console.log('all', all);
      // If your backend supports filtering by status in the URL, prefer that.
      const filtered =
        inviteFilter === 'all'
          ? all
          : all.data.filter((i: Invite) => i.status === inviteFilter);
      console.log('filtered', filtered);
      setInvites(filtered);
      await emitInboxEvent(business.id);
    } catch {
      setInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }, [business?.id, inviteFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchDrivers();
      fetchInvites();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  }, [fetchDrivers]);

  const onRefreshInvites = useCallback(async () => {
    setInviteRefreshing(true);
    await fetchInvites();
    setInviteRefreshing(false);
  }, [fetchInvites]);

  /* ─────────────── derived ─────────────── */

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter(d => {
      const fullName = [
        d?.Profile?.first_name ?? '',
        d?.Profile?.last_name ?? '',
      ].join(' ');
      const matchesQuery =
        !q ||
        [d.name, fullName, d.phone, d.email, d.route_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);

      const effectiveStatus = (d.availability || d.status) as
        | DriverStatus
        | undefined;
      const matchesStatus =
        statusFilter === 'all' ? true : effectiveStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [drivers, query, statusFilter]);

  const filteredInvites = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    return invites.filter(i => {
      const nm = [i.first_name, i.last_name].filter(Boolean).join(' ');
      const matchesQuery =
        !q ||
        [nm, i.invited_email, i.invited_phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      const matchesStatus =
        inviteFilter === 'all' ? true : i.status === inviteFilter;
      return matchesQuery && matchesStatus;
    });
  }, [invites, inviteQuery, inviteFilter]);

  // Map helpers based on filteredDrivers
  const coords = useMemo(
    () =>
      filteredDrivers
        .filter(d => typeof d.lat === 'number' && typeof d.lng === 'number')
        .map(d => [d.lng as number, d.lat as number] as [number, number]),
    [filteredDrivers],
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (coords.length > 0) {
      const avgLng =
        coords.reduce((sum, c) => sum + c[0], 0) / Math.max(1, coords.length);
      const avgLat =
        coords.reduce((sum, c) => sum + c[1], 0) / Math.max(1, coords.length);
      return [avgLng, avgLat];
    }
    // fallback center (USA)
    return [-98.35, 39.5];
  }, [coords]);

  const mapZoom = useMemo(() => {
    if (coords.length === 0) return 3; // zoomed out
    if (coords.length === 1) return 11;
    if (coords.length < 5) return 8;
    return 4;
  }, [coords]);

  /* ─────────────── actions ─────────────── */

  const onInvite = () => {
    nav.navigate('DriverInvite');
  };

  const onOpenProfile = (driver: Driver) => {
    nav.navigate('DriverProfile', { driverId: driver.id });
  };

  const onCall = (driver: Driver) => {
    if (!driver.phone) return;
    Linking.openURL(`tel:${driver.phone}`);
  };

  // Invite actions (assumes backend routes exist)
  const getInviteLink = async (inviteId: number) => {
    const res = await api.post('/invites/get-link', { inviteId });
    if (!res?.inviteLink) throw new Error('No inviteLink returned');
    return res.inviteLink as string;
  };

  const handleCopyLink = async (inv: Invite) => {
    try {
      const link = await getInviteLink(inv.id);
      Clipboard.setString(link);
      Alert.alert('Copied', 'Invite link copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Copy failed', e?.message || 'Unable to copy link');
    }
  };

  const handleShareLink = async (inv: Invite) => {
    try {
      const link = await getInviteLink(inv.id);
      await Share.share({ message: link, url: link });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Unable to share link');
    }
  };

  const handleResend = async (inv: Invite) => {
    try {
      await api.post('/invites/resend', { inviteId: inv.id });
      await fetchInvites();
      Alert.alert('Invite resent', 'We re-sent the invite email.');
    } catch (e: any) {
      Alert.alert('Resend failed', e?.message || 'Unable to resend invite');
    }
  };

  const handleRevoke = async (inv: Invite) => {
    Alert.alert(
      'Revoke invite?',
      'This will prevent signup with this link/code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/invites/revoke', { inviteId: inv.id });
              await fetchInvites();
              Alert.alert(
                'Invite revoked',
                'The invite can no longer be used.',
              );
            } catch (e: any) {
              Alert.alert(
                'Revoke failed',
                e?.message || 'Unable to revoke invite',
              );
            }
          },
        },
      ],
    );
  };

  const handleDelete = async (inv: Invite) => {
    Alert.alert(
      'Delete invite?',
      'This permanently removes the invite record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/invites/delete', { inviteId: inv.id });
              setInvites(prev => prev.filter(x => x.id !== inv.id));
              Alert.alert('Invite deleted', 'The invite record was removed.');
            } catch (e: any) {
              Alert.alert(
                'Delete failed',
                e?.message || 'Unable to delete invite',
              );
            }
          },
        },
      ],
    );
  };

  /* ─────────────── UI helpers ─────────────── */

  const statusColor = (s: DriverStatus) => {
    switch (s) {
      case 'on_route':
        return '#10B981';
      case 'available':
        return '#3B82F6';
      case 'off_duty':
        return '#9CA3AF';
      case 'pending':
        return '#F59E0B';
    }
  };

  const effectiveDriverStatus = (d: Driver): DriverStatus | undefined =>
    (d.availability || d.status) as DriverStatus | undefined;

  const presenceText = (d: Driver) => {
    if (!d.last_seen_at) return 'Last seen: —';
    const mins = Math.max(
      0,
      Math.floor((Date.now() - new Date(d.last_seen_at).getTime()) / 60000),
    );
    if (mins < 1) return 'Last seen: just now';
    if (mins === 1) return 'Last seen: 1 min ago';
    return `Last seen: ${mins} mins ago`;
  };

  const driverName = (d: Driver) =>
    d?.name ||
    [d?.Profile?.first_name ?? '', d?.Profile?.last_name ?? '']
      .join(' ')
      .trim() ||
    'Driver';

  const chipLabel = (k: DriverStatus | 'all') => {
    switch (k) {
      case 'all':
        return 'All';
      case 'on_route':
        return 'On Route';
      case 'available':
        return 'Available';
      case 'off_duty':
        return 'Off Duty';
      case 'pending':
        return 'Pending';
    }
  };

  /* ─────────────── action menu (drivers) ─────────────── */

  const ActionMenu = () => {
    if (!actionDriver) return null;
    return (
      <Modal
        visible={!!actionDriver}
        transparent
        animationType="fade"
        onRequestClose={() => setActionDriver(null)}
      >
        <View style={tw`flex-1 bg-black/40`}>
          <View
            style={[
              tw`mt-auto rounded-t-3xl p-4`,
              { backgroundColor: colors.main },
            ]}
          >
            <Text
              style={[tw`text-xl font-semibold mb-3`, { color: colors.text }]}
            >
              Actions
            </Text>

            <SheetButton
              label="View Profile"
              onPress={() => {
                onOpenProfile(actionDriver);
                setActionDriver(null);
              }}
              colors={colors}
            />
            <SheetButton
              label="Call Driver"
              onPress={() => {
                onCall(actionDriver);
                setActionDriver(null);
              }}
              colors={colors}
              LeftIcon={Phone}
            />
            <SheetButton
              label="Assign to Route"
              onPress={() => {
                setActionDriver(null);
                nav.navigate('AssignDriverToRoute', {
                  driverId: actionDriver.id,
                });
              }}
              colors={colors}
            />
            <SheetButton
              label="Deactivate"
              onPress={() => {
                setActionDriver(null);
                nav.navigate('DeactivateDriver', { driverId: actionDriver.id });
              }}
              colors={colors}
              danger
            />

            <TouchableOpacity
              onPress={() => setActionDriver(null)}
              style={[
                tw`mt-2 px-4 py-3 rounded-2xl items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.text }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  /* ─────────────── render ─────────────── */

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header + Tabs */}
      <View style={tw`px-4 pt-4 pb-2 w-full`}>
        <Text style={[tw`text-2xl font-bold mb-3`, { color: colors.text }]}>
          Drivers
        </Text>
      </View>

      <View style={tw`px-4 w-full mb-4`}>
        <View style={tw`flex-row bg-black/20 rounded-xl`}>
          {(['drivers', 'invites'] as TabKey[]).map(k => {
            const active = tab === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setTab(k)}
                style={[
                  tw`flex-1 py-2 rounded-lg items-center`,
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
                  {k}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bottom controls (only for Drivers tab) */}
      {tab === 'drivers' && (
        <View
          style={tw`absolute z-10 left-0 right-0 bottom-0 flex-row items-center justify-between p-4`}
        >
          <View
            style={[
              tw`flex-row p-1 rounded-xl`,
              { backgroundColor: colors.border },
            ]}
          >
            <Toggle
              active={viewMode === 'list'}
              onPress={() => setViewMode('list')}
              label=""
              colors={colors}
              Icon={ListIcon}
            />
            <Toggle
              active={viewMode === 'map'}
              onPress={() => setViewMode('map')}
              label=""
              colors={colors}
              Icon={MapIcon}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              tw`px-3 py-2 rounded-full flex-row items-center`,
              { backgroundColor: colors.brand.primary },
            ]}
            onPress={onInvite}
          >
            <PlusCircle width={18} height={18} color="#fff" />
            <Text style={tw`text-white ml-2 font-semibold`}>Add Driver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search + Filters */}
      {tab === 'drivers' ? (
        <View style={tw`px-4`}>
          <View
            style={[
              tw`flex-row items-center px-3 py-2 rounded-2xl`,
              { backgroundColor: colors.border },
            ]}
          >
            <SearchIcon width={16} height={16} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, phone, email, route…"
              placeholderTextColor={'#9CA3AF'}
              style={[tw`ml-2 flex-1`, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onRefresh} style={tw`pl-2`}>
              <RefreshCcw width={16} height={16} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={tw`flex-row mt-2 mb-2`}>
            {(
              ['all', 'on_route', 'available', 'off_duty', 'pending'] as const
            ).map(s => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                onPress={() => setStatusFilter(s)}
                label={chipLabel(s)}
                colors={colors}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={tw`px-4`}>
          <View
            style={[
              tw`flex-row items-center px-3 py-2 rounded-2xl`,
              { backgroundColor: colors.border },
            ]}
          >
            <SearchIcon width={16} height={16} color="#9CA3AF" />
            <TextInput
              value={inviteQuery}
              onChangeText={setInviteQuery}
              placeholder="Search name, email, phone…"
              placeholderTextColor={'#9CA3AF'}
              style={[tw`ml-2 flex-1`, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onRefreshInvites} style={tw`pl-2`}>
              <RefreshCcw width={16} height={16} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={tw`flex-row mt-2 mb-2 flex-wrap`}>
            {(['pending', 'completed', 'declined', 'expired'] as const).map(
              s => (
                <FilterChip
                  key={s}
                  active={inviteFilter === s}
                  onPress={() => setInviteFilter(s)}
                  label={s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
                  colors={colors}
                />
              ),
            )}
          </View>
        </View>
      )}

      {/* Body */}
      <View style={tw`flex-1`}>
        {tab === 'drivers' ? (
          loading ? (
            <CenteredLoader colors={colors} text="Loading drivers…" />
          ) : filteredDrivers.length === 0 ? (
            <EmptyState
              colors={colors}
              onInvite={onInvite}
              queryActive={!!query || statusFilter !== 'all'}
            />
          ) : viewMode === 'list' ? (
            <View style={tw`flex-1 mt-4`}>
              <Text
                style={[tw`text-lg font-semibold px-4`, { color: colors.text }]}
              >
                All Drivers:
              </Text>
              <FlatList
                data={filteredDrivers}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={tw`px-4 pb-8`}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.text}
                  />
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => onOpenProfile(item)}
                    style={[
                      tw`flex-row items-center px-2 py-2 mb-2 mt-2 rounded-xl`,
                      { backgroundColor: colors.main },
                    ]}
                  >
                    {/* presence + avatar */}
                    <View
                      style={[
                        tw`w-10 h-10 rounded-lg items-center justify-center mr-3`,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <View
                        style={{
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: statusColor(
                            effectiveDriverStatus(item) || 'available',
                          ),
                          borderWidth: 2,
                          borderColor: colors.main,
                        }}
                      />
                      <Text style={[tw`font-bold`, { color: colors.text }]}>
                        {initials(driverName(item))}
                      </Text>
                    </View>

                    {/* middle */}
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center justify-between`}>
                        <Text
                          numberOfLines={1}
                          style={[
                            tw`text-base font-semibold`,
                            { color: colors.text },
                          ]}
                        >
                          {driverName(item)}
                        </Text>
                        <StatusPill
                          status={
                            (effectiveDriverStatus(item) ||
                              'available') as DriverStatus
                          }
                          colors={colors}
                        />
                      </View>
                      <View style={tw`flex-row items-end justify-between`}>
                        <View style={tw`flex-1 flex items-start`}>
                          {!!(item.job_title || item.employment) && (
                            <View
                              style={tw`flex-row items-center justify-start mt-1`}
                            >
                              {!!item.job_title && (
                                <Text
                                  numberOfLines={1}
                                  style={[tw`text-xs`, { color: colors.text }]}
                                >
                                  {item.job_title}
                                </Text>
                              )}
                              {!!item.employment && (
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    tw`text-xs mt-0.5 ml-2`,
                                    { color: colors.muted },
                                  ]}
                                >
                                  ({item.employment})
                                </Text>
                              )}
                            </View>
                          )}
                          <View
                            style={tw`flex-row items-center justify-start mt-1`}
                          >
                            <Text
                              numberOfLines={1}
                              style={[tw`text-xs`, { color: colors.text }]}
                            >
                              {presenceText(item)}
                            </Text>
                            {!!item.phone && (
                              <View style={tw`flex-row items-center ml-2`}>
                                <Phone
                                  width={12}
                                  height={12}
                                  color={colors.text}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    tw`text-xs mt-0.5 ml-1`,
                                    { color: colors.muted },
                                  ]}
                                >
                                  {item.phone}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={tw`flex-row items-end justify-end`}>
                          {item.phone ? (
                            <TouchableOpacity
                              onPress={() => onCall(item)}
                              style={[
                                tw`p-2 rounded-lg mr-1`,
                                { backgroundColor: colors.border },
                              ]}
                            >
                              <Phone
                                width={16}
                                height={16}
                                color={colors.text}
                              />
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            onPress={() => setActionDriver(item)}
                            style={[
                              tw`p-2 rounded-lg`,
                              { backgroundColor: colors.border },
                            ]}
                          >
                            <MoreVertical
                              width={16}
                              height={16}
                              color={colors.text}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : (
            <MapboxGL.MapView
              style={tw`flex-1`}
              styleURL={MapboxGL.StyleURL.Street}
              logoEnabled={false}
              compassEnabled
            >
              <MapboxGL.Camera
                centerCoordinate={mapCenter}
                zoomLevel={mapZoom}
                animationMode="flyTo"
                animationDuration={600}
              />
              {filteredDrivers
                .filter(
                  d => typeof d.lat === 'number' && typeof d.lng === 'number',
                )
                .map(d => (
                  <MapboxGL.PointAnnotation
                    key={String(d.id)}
                    id={String(d.id)}
                    coordinate={[d.lng as number, d.lat as number]}
                    onSelected={() => onOpenProfile(d)}
                  >
                    <View
                      style={[
                        tw`items-center justify-center`,
                        { transform: [{ translateY: -6 }] },
                      ]}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: statusColor(
                            (effectiveDriverStatus(d) ||
                              'available') as DriverStatus,
                          ),
                          borderWidth: 2,
                          borderColor: '#fff',
                          shadowColor: '#000',
                          shadowOpacity: 0.2,
                          shadowRadius: 2,
                          elevation: 2,
                        }}
                      />
                      <Text
                        numberOfLines={1}
                        style={[tw`text-2xs mt-0.5`, { color: '#111' }]}
                      >
                        {initials(driverName(d))}
                      </Text>
                    </View>
                    <MapboxGL.Callout
                      title={`${driverName(d)}\n${metaLine(d)}`}
                    />
                  </MapboxGL.PointAnnotation>
                ))}
            </MapboxGL.MapView>
          )
        ) : // INVITES TAB
        loadingInvites ? (
          <CenteredLoader colors={colors} text="Loading invites…" />
        ) : filteredInvites.length === 0 ? (
          <View style={tw`flex-1 items-center justify-center px-8`}>
            <Text style={[tw`text-lg font-semibold`, { color: colors.text }]}>
              No invites
            </Text>
            <Text
              style={[tw`text-xs mt-1 text-center`, { color: colors.muted }]}
            >
              Create a new invite with “Add Driver”.
            </Text>
          </View>
        ) : (
          <View style={tw`flex-1`}>
            <Text
              style={[
                tw`text-lg font-semibold px-4 mt-4 mb-2`,
                { color: colors.text },
              ]}
            >
              All Invites:
            </Text>
            <FlatList
              data={filteredInvites}
              keyExtractor={i => String(i.id)}
              contentContainerStyle={tw`px-4 pb-20`}
              refreshControl={
                <RefreshControl
                  refreshing={inviteRefreshing}
                  onRefresh={onRefreshInvites}
                  tintColor={colors.text}
                />
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    tw`px-3 py-3 mb-2 rounded-xl`,
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
                      {(item.first_name || '—') + ' ' + (item.last_name || '')}
                    </Text>
                    <StatusPillInvite status={item.status} colors={colors} />
                  </View>

                  <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
                    {item.invited_email || '—'}
                    {item.invited_phone ? ` • ${item.invited_phone}` : ''}
                  </Text>

                  <Text style={[tw`text-2xs mt-1`, { color: colors.muted }]}>
                    Code: {item.reference_code || '—'} • Sent:{' '}
                    {item.sent_at
                      ? new Date(item.sent_at).toLocaleString()
                      : '—'}
                  </Text>

                  <View style={tw`flex-row mt-2`}>
                    {/* <SmallBtn
                      label="Copy Link"
                      onPress={() => handleCopyLink(item)}
                      colors={colors}
                    />
                    <SmallBtn
                      label="Share"
                      onPress={() => handleShareLink(item)}
                      colors={colors}
                    /> */}
                    <SmallBtn
                      label="Resend"
                      onPress={() => handleResend(item)}
                      colors={colors}
                    />
                    <SmallBtn
                      label="Revoke"
                      onPress={() => handleRevoke(item)}
                      colors={colors}
                      danger
                    />
                    <SmallBtn
                      label="Delete"
                      onPress={() => handleDelete(item)}
                      colors={colors}
                      danger
                    />
                  </View>
                </View>
              )}
            />
          </View>
        )}
      </View>

      <ActionMenu />
    </View>
  );
}

/* ───────────────── helpers & tiny components ───────────────── */

function Toggle({
  active,
  onPress,
  colors,
  Icon,
}: {
  active: boolean;
  onPress: () => void;
  colors: any;
  Icon: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-2 rounded-lg flex-row items-center`,
        { backgroundColor: active ? '#2563eb' : 'transparent' },
      ]}
    >
      <Icon width={14} height={14} color={active ? '#fff' : colors.text} />
    </TouchableOpacity>
  );
}

function FilterChip({
  active,
  onPress,
  label,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-3 py-1.5 rounded-lg mr-2 mb-2`,
        { backgroundColor: active ? '#2563eb' : colors.border },
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

function EmptyState({
  colors,
  onInvite,
  queryActive,
}: {
  colors: any;
  onInvite: () => void;
  queryActive: boolean;
}) {
  return (
    <View style={tw`flex-1 items-center justify-center px-8`}>
      <Text style={[tw`text-lg font-semibold`, { color: colors.text }]}>
        {queryActive ? 'No matching drivers' : 'No drivers yet'}
      </Text>

      <Text style={[tw`text-xs mt-1 text-center`, { color: colors.muted }]}>
        {queryActive
          ? 'Try adjusting your search or filters.'
          : 'Invite your first driver to get started.'}
      </Text>

      {!queryActive && (
        <TouchableOpacity
          onPress={onInvite}
          activeOpacity={0.9}
          style={[
            tw`mt-4 px-4 py-2 rounded-xl`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>Add Driver</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatusPill({ status, colors }: { status: DriverStatus; colors: any }) {
  const map: Record<DriverStatus, { text: string; bg: string }> = {
    on_route: { text: 'On Route', bg: '#10B981' },
    available: { text: 'Available', bg: '#3B82F6' },
    off_duty: { text: 'Off Duty', bg: '#9CA3AF' },
    pending: { text: 'Pending', bg: '#F59E0B' },
  };
  return (
    <View
      style={[
        tw`px-2 py-0.5 rounded-full ml-2`,
        { backgroundColor: map[status].bg },
      ]}
    >
      <Text style={tw`text-white text-2xs font-semibold`}>
        {map[status].text}
      </Text>
    </View>
  );
}

function StatusPillInvite({
  status,
  colors,
}: {
  status: InviteStatus;
  colors: any;
}) {
  const map: Record<InviteStatus, { text: string; bg: string }> = {
    pending: { text: 'Pending', bg: '#F59E0B' },
    sent: { text: 'Sent', bg: '#3B82F6' },
    claimed: { text: 'Claimed', bg: '#10B981' },
    completed: { text: 'Completed', bg: '#10B981' },
    declined: { text: 'Declined', bg: '#EF4444' },
    revoked: { text: 'Revoked', bg: '#6B7280' },
    expired: { text: 'Expired', bg: '#6B7280' },
  };
  return (
    <View
      style={[
        tw`px-2 py-0.5 rounded-full`,
        { backgroundColor: map[status].bg },
      ]}
    >
      <Text style={tw`text-white text-2xs font-semibold`}>
        {map[status].text}
      </Text>
    </View>
  );
}

function SmallBtn({
  label,
  onPress,
  colors,
  danger,
}: {
  label: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`px-2 py-1 mr-2 rounded-lg`,
        { backgroundColor: danger ? 'rgba(239,68,68,0.15)' : colors.border },
      ]}
    >
      <Text
        style={[
          tw`text-2xs font-semibold`,
          { color: danger ? '#ef4444' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CenteredLoader({ colors, text }: { colors: any; text: string }) {
  return (
    <View style={tw`flex-1 items-center justify-center`}>
      <ActivityIndicator />
      <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts[1]?.[0] || '';
  return (first + last).toUpperCase() || 'DR';
}

function metaLine(d: Driver) {
  const st = (d.availability || d.status) as DriverStatus | undefined;
  if (st === 'on_route') {
    const eta = d.next_eta ? ` • ETA ${d.next_eta}` : '';
    const route = d.route_name ? ` • ${d.route_name}` : '';
    return `On Route${route}${eta}`;
  }
  if (st === 'available') return 'Available';
  if (st === 'pending') return 'Pending invite';
  return 'Off Duty';
}
