// src/app/routes/RouteDraftScreen.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
} from 'react-native-feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import Field from '../../shared/components/inputs/Field';
import FieldSuggestions from '../../shared/components/inputs/FieldSuggestions';
import { api } from '../../shared/lib/api';
import { getRouteById } from '../../shared/lib/RouteHelpers';
import { deleteStop } from '../../shared/lib/StopsHelpers';

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

type Stop = {
  id: number;
  route_id: number;
  customer_name: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  planned_service_minutes: number | null;
  window_start: string | null; // HH:mm (optional)
  window_end: string | null; // HH:mm (optional)
  notes: string | null;
  sequence: number; // order
  // add other fields your schema needs
};

type StopInput = Partial<Stop> & {
  route_id: number;
};

function formatTimeHM(iso: string | null | undefined) {
  if (!iso) return '';
  // iso like '2025-10-02T08:00:00'
  const d = new Date(iso);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatHMAmPm(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso); // converts UTC ISO to local time on device

  // Prefer Intl if available (RN Hermes has it on modern versions)
  try {
    return d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    // Fallback: manual 12h format
    let h = d.getHours();
    const m = `${d.getMinutes()}`.padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // 0 -> 12
    return `${h}:${m} ${ampm}`;
  }
}

export default function RouteDraftScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { routeId, payload } = params as RouteParams;

  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [route, setRoute] = useState<any>(null);

  // Stop modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);

  const [headerTitle, setHeaderTitle] = useState('');

  useEffect(() => {
    console.log('payload', payload);
    const d = new Date(payload.service_date);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    console.log('label', label);
    setHeaderTitle(label);
  }, [payload]);

  useFocusEffect(
    useCallback(() => {
      fetchStops();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useLayoutEffect(() => {
    fetchStops();
  }, []);

  const fetchStops = async () => {
    setLoading(true);
    try {
      const res = await getRouteById(routeId);
      console.log('res', res.data.stops);
      setRoute(res.data);
      setStops(res.data.stops.sort((a, b) => a.sequence - b.sequence));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load stops');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    nav.navigate('AddStopScreen1', { routeId, stopsCount: stops.length });
  };
  const openEdit = (s: Stop) => {
    nav.navigate('StopSummaryEditScreen', { stop: s });
  };

  const onDelete = (s: Stop) => {
    Alert.alert('Remove stop?', `Delete "${s.customer_name ?? 'Stop'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/routes/stops/${s.id}`);
            setStops(prev =>
              prev
                .filter(x => x.id !== s.id)
                .map((x, i) => ({ ...x, sequence: i + 1 })),
            );
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Delete failed');
          }
        },
      },
    ]);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setStops(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((x, i) => ({ ...x, sequence: i + 1 }));
    });
  };
  const moveDown = (index: number) => {
    if (index === stops.length - 1) return;
    setStops(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((x, i) => ({ ...x, sequence: i + 1 }));
    });
  };

  const persistOrder = async () => {
    setSavingOrder(true);
    try {
      const ordered_ids = stops.map(s => s.id);
      await api.post(`/routes/${routeId}/reorder-stops`, { ordered_ids });
      Alert.alert('Saved', 'Stop order updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save order');
    } finally {
      setSavingOrder(false);
    }
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
    try {
      await api.post(`/routes/${routeId}/publish`, { status: 'scheduled' });
      Alert.alert('Published', 'Route scheduled!');
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to publish route');
    } finally {
      setPublishing(false);
    }
  };

  const plannedStartHM = formatHMAmPm(payload.planned_start_at);

  const confirmDelete = (s: Stop) => {
    Alert.alert('Remove stop?', `Delete "${s.customer_name ?? 'Stop'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteStop(s.id);
          fetchStops();
        },
      },
    ]);
  };

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
            Route Draft
          </Text>
        </View>
      </View>

      {/* Stops list as FlatList (prevents nested virtualized lists warnings) */}
      <FlatList
        data={stops}
        keyExtractor={item => `${item.id}`}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={tw`px-4`}>
            {/* Summary card */}
            <View
              style={[
                tw`rounded-2xl p-3 mb-3`,
                { backgroundColor: colors.border },
              ]}
            >
              <Text
                style={[tw`text-lg font-semibold mb-1`, { color: colors.text }]}
              >
                {payload.name}
              </Text>

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

              <View style={tw`flex-row items-center`}>
                <User width={14} height={14} color={colors.text} />
                <Text style={[tw`ml-2 text-sm`, { color: colors.text }]}>
                  Driver: #{payload.employee_id ?? '—'}
                  {' / '}
                  {route?.profile?.first_name ?? ''}{' '}
                  {route?.profile?.last_name ?? ''}
                </Text>
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
                  onPress={persistOrder}
                  disabled={savingOrder}
                  style={[
                    tw`px-3 py-2 rounded-xl mr-2`,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {savingOrder ? 'Saving…' : 'Save Order'}
                  </Text>
                </TouchableOpacity>
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
          console.log('item', item);
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
                    {item.business_name ||
                      item.contact_name ||
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
                      {item.address_line1}, {item.city}, {item.region},
                      {item.postal_code}
                    </Text>
                  </View>
                )}
                <View style={tw`flex-row items-center justify-start mt-1`}>
                  {!!item.contact_name && (
                    <View style={tw`flex-row items-center mr-2`}>
                      <User width={14} height={14} color={colors.muted} />
                      <Text
                        style={[tw`ml-2 text-sm`, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.contact_name}
                      </Text>
                    </View>
                  )}
                  {!!item.contact_phone && (
                    <View style={tw`flex-row items-center ml-4`}>
                      <Phone width={14} height={14} color={colors.muted} />
                      <Text
                        style={[tw`ml-2 text-sm`, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.contact_phone}
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
                      {item.stop_type}
                    </Text>
                  </View>
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      onPress={() => moveUp(index)}
                      disabled={index === 0}
                      style={[
                        tw`px-2 py-2 rounded-xl mr-2`,
                        {
                          backgroundColor: colors.main,
                          opacity: index === 0 ? 0.5 : 1,
                        },
                      ]}
                    >
                      <ArrowUp width={16} height={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveDown(index)}
                      disabled={index === stops.length - 1}
                      style={[
                        tw`px-2 py-2 rounded-xl`,
                        {
                          backgroundColor: colors.main,
                          opacity: index === stops.length - 1 ? 0.5 : 1,
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
              <Text style={tw`text-white font-semibold`}>
                {publishing ? 'Publishing…' : 'Publish Route'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* STOP FORM MODAL */}
      <StopFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        colors={colors}
        initial={editingStop}
        onSubmit={async form => {
          try {
            if (editingStop) {
              const { data } = await api.patch<{ data: Stop }>(
                `/routes/stops/${editingStop.id}`,
                form,
              );
              setStops(prev =>
                prev.map(s =>
                  s.id === editingStop.id ? { ...s, ...data.data } : s,
                ),
              );
            } else {
              // set sequence to end
              const sequence = (stops[stops.length - 1]?.sequence ?? 0) + 1;
              const payload: StopInput = {
                ...form,
                route_id: routeId,
                sequence,
              };
              const { data } = await api.post<{ data: Stop }>(
                `/routes/${routeId}/stops`,
                payload,
              );
              setStops(prev =>
                [...prev, data.data].sort((a, b) => a.sequence - b.sequence),
              );
            }
            setModalOpen(false);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Save failed');
          }
        }}
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

  // break address pieces + geocode when user selects a suggestion
  useEffect(() => {
    if (!address) return;
    const parts = address.split(', ');
    setLine1(parts[0] ?? '');
    setCity(parts[1] ?? '');
    setRegion(parts[2] ?? '');
    // geocode (RapidAPI sample; replace with your util if you have one)
    // keep silent if it fails
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

  const toTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0',
    )}`;

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

          {/* Form (no outer ScrollView to avoid nested VirtualizedList warnings) */}
          <Field
            label="Customer"
            value={customer}
            onChangeText={setCustomer}
            colors={colors}
          />

          {/* Suggest & capture address */}
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

          {/* Address fields */}
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
