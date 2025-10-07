// src/app/routes/EditRouteScreen.tsx
import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Calendar,
  ChevronLeft,
  Tag,
  MapPin,
  X as CloseIcon,
} from 'react-native-feather';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { buildDateRange } from '../../shared/utils/dates';
import { useSession } from '../../state/useSession';
import FieldSuggestions from '../../shared/components/inputs/FieldSuggestions';
import axios from 'axios';
import Field from '../../shared/components/inputs/Field';
import SelectInput from '../../shared/components/inputs/SelectInput';
import { getDrivers } from '../../shared/lib/DriversHelpers';
import DriverPickerModal from '../../shared/components/modals/DriverPickerModal';
import { createDraftRoute, updateRouter } from '../../shared/lib/RouteHelpers';
import { CreateInbox } from '../../shared/lib/inboxHelpers';

/* ───────────────── types ───────────────── */

type Employee = {
  id: number; // employee id
  is_driver?: boolean | null;
  work_email?: string | null;
  phone?: string | null;
  Profile?: {
    id?: number | null; // profile id
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

type RouteRecord = {
  id: number;
  business_id: number;
  employee_id: number | null; // employee id
  driver_id: number | null; // profile id
  name: string;
  service_date: string; // YYYY-MM-DD
  status: string;
  planned_start_at: string | null; // ISO
  start_longitude: number | null;
  start_latitude: number | null;
  notes: string | null;
  tags: string[] | null;
  single_day?: boolean | null;
  optimize?: boolean | null;
  profile?: { id?: number | null } | null;

  // Optional text address fields (hydrate if you store them)
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

/* ─────────────── helpers ─────────────── */

function toHHmm(d: Date) {
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

// ISO (UTC) → HH:mm in device local time (for the picker)
function isoToLocalHHmm(iso?: string | null) {
  if (!iso) return '08:00';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Combine local YYYY-MM-DD + HH:mm → UTC ISO string
export function combineISODateAndTimeUTC(isoDate: string, timeHHmm: string) {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const [h = 0, m = 0] = timeHHmm.split(':').map(Number);
  const local = new Date(y, (mo ?? 1) - 1, d ?? 1, h, m, 0, 0);
  return local.toISOString();
}

/* ─────────────── screen ─────────────── */

export default function EditRouteScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const initialRoute: RouteRecord | undefined = params?.route; // pass as { route }

  const { business, profile } = useSession();

  const items = buildDateRange(8); // today + next 7
  const initialISO =
    initialRoute?.service_date ??
    params?.serviceDateISO ??
    (items[0]?.iso || new Date().toISOString().slice(0, 10));

  // Basics
  const [name, setName] = useState<string | null>(
    initialRoute?.name ?? 'New Route',
  );
  const [selectedIso] = useState(initialISO);

  // Time picker
  const [plannedStart, setPlannedStart] = useState(
    isoToLocalHHmm(initialRoute?.planned_start_at),
  ); // HH:mm
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Drivers
  const [allDrivers, setAllDrivers] = useState<Employee[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Employee | null>(null);
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  // Depot/Base
  const hasCustomStart =
    typeof initialRoute?.start_latitude === 'number' ||
    typeof initialRoute?.start_longitude === 'number';
  const [useBusinessHQ, setUseBusinessHQ] = useState(!hasCustomStart);
  const [line1, setLine1] = useState(initialRoute?.address_line1 ?? '');
  const [line2, setLine2] = useState(initialRoute?.address_line2 ?? '');
  const [city, setCity] = useState(initialRoute?.city ?? '');
  const [region, setRegion] = useState(initialRoute?.region ?? '');
  const [postal, setPostal] = useState(initialRoute?.postal_code ?? '');
  const [country, setCountry] = useState(initialRoute?.country ?? 'US');

  // Tags & Notes
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(initialRoute?.tags) ? initialRoute!.tags!.join(', ') : '',
  );
  const [notes, setNotes] = useState(initialRoute?.notes ?? '');

  // Address search
  const [address, setAddress] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [latitude, setLatitude] = useState(initialRoute?.start_latitude || 0);
  const [longitude, setLongitude] = useState(
    initialRoute?.start_longitude || 0,
  );

  // Flags
  const [singleDay, setSingleDay] = useState(initialRoute?.single_day ?? true);
  const [routeOptimize, setRouteOptimize] = useState(
    initialRoute?.optimize ?? true,
  );

  const [loading, setLoading] = useState(false);

  /* ─────────────── data ─────────────── */

  useLayoutEffect(() => {
    if (!business?.id) return;
    (async () => {
      const res = await getDrivers(business.id);
      setAllDrivers(res?.data ?? []);
    })();
  }, [business?.id]);

  // Preselect driver from the route record if present
  useEffect(() => {
    if (!allDrivers.length) return;

    // Prefer by employee_id (routes table uses employee ids)
    if (initialRoute?.employee_id) {
      const match =
        allDrivers.find(x => x.id === initialRoute.employee_id) || null;
      if (match) {
        setSelectedDriver(match);
        return;
      }
    }

    // Fallback: match by profile id (route.profile.id)
    if (initialRoute?.profile?.id) {
      const match =
        allDrivers.find(x => x.Profile?.id === initialRoute.profile!.id) ||
        null;
      if (match) {
        setSelectedDriver(match);
        return;
      }
    }

    // Else default: first available
    if (!selectedDriver) {
      setSelectedDriver(allDrivers[0] ?? null);
    }
  }, [allDrivers, initialRoute?.employee_id, initialRoute?.profile?.id]);

  /* ─────────────── derived ─────────────── */

  const headerTitle = useMemo(() => {
    const d = new Date(selectedIso);
    const isToday = selectedIso === new Date().toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return isToday ? `Today — ${label}` : label;
  }, [selectedIso]);

  const selectedDriverLabel = useMemo(() => {
    if (!selectedDriver) return 'Select';
    const fn = selectedDriver.Profile?.first_name?.trim() ?? '';
    const ln = selectedDriver.Profile?.last_name?.trim() ?? '';
    const full = `${fn} ${ln}`.trim();
    return (
      full ||
      selectedDriver.work_email ||
      selectedDriver.Profile?.email ||
      'Select'
    );
  }, [selectedDriver]);

  const valid = useMemo(() => {
    if (!name?.trim()) return false;
    if (!selectedIso) return false;
    if (!selectedDriver?.id) return false;
    if (!plannedStart || !/^\d{2}:\d{2}$/.test(plannedStart)) return false;
    return true;
  }, [name, selectedIso, selectedDriver?.id, plannedStart]);

  /* ─────────────── address geocode ─────────────── */

  useEffect(() => {
    if (!address) return;
    const full = address.split(', ');
    setLine1(full[0] ?? '');
    setCity(full[1] ?? '');
    setRegion(full[2] ?? '');
    (async () => {
      try {
        const res = await axios.request({
          method: 'GET',
          url: 'https://google-maps-geocoding3.p.rapidapi.com/geocode',
          params: { address },
          headers: {
            'x-rapidapi-key':
              'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
            'x-rapidapi-host': 'google-maps-geocoding3.p.rapidapi.com',
          },
        });
        if (res?.data?.latitude && res?.data?.longitude) {
          setLatitude(parseFloat(res.data.latitude));
          setLongitude(parseFloat(res.data.longitude));
        }
      } catch {
        // silent fail ok
      }
    })();
  }, [address]);

  const handleSearchAddress = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await axios.request({
        method: 'GET',
        url: 'https://google-place-autocomplete-and-place-info.p.rapidapi.com/maps/api/place/autocomplete/json',
        params: { input: text },
        headers: {
          'x-rapidapi-key':
            'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
          'x-rapidapi-host':
            'google-place-autocomplete-and-place-info.p.rapidapi.com',
        },
      });
      setSuggestions(response.data?.predictions || []);
    } catch {
      Alert.alert('Error', 'Error searching business addresses.');
    }
  };

  /* ─────────────── inbox notify (optional) ─────────────── */

  const notifyRouteDraftCreated = async ({
    businessId,
    routeId,
    routeName,
    serviceDateISO,
    plannedStartISO,
    creatorProfileId,
    driverProfileId,
  }: {
    businessId: number;
    routeId: number;
    routeName: string;
    serviceDateISO: string;
    plannedStartISO: string;
    creatorProfileId: number | null;
    driverProfileId: number | null;
  }) => {
    const basePayload = {
      businessId,
      type: 'route_draft',
      severity: 'info',
      title: 'Route draft created',
      body: `“${routeName}” scheduled for ${serviceDateISO}.`,
      actor: 'owner_app',
      actor_id: creatorProfileId,
      actionable: true,
      action_label: 'Open draft',
      action_route: 'RouteDraftScreen',
      action_params: { routeId },
      metadata: {
        routeId,
        routeName,
        serviceDateISO,
        plannedStartISO,
      },
      single_day: singleDay,
    };

    await CreateInbox({
      ...basePayload,
      profile_id: creatorProfileId,
      dedupe_key: `route.draft.created:${routeId}:${creatorProfileId}`,
    });

    if (driverProfileId) {
      await CreateInbox({
        ...basePayload,
        title: 'A new route (draft) was created',
        body: `“${routeName}” (${serviceDateISO}) has been assigned.`,
        profile_id: driverProfileId,
        dedupe_key: `route.draft.created:${routeId}:${driverProfileId}`,
      });
    }
  };

  /* ─────────────── actions ─────────────── */

  const handlePickTime = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPlannedStart(toHHmm(selected));
    if (Platform.OS === 'android') setShowTimePicker(false);
  };

  const onSave = async () => {
    setLoading(true);

    if (!valid) {
      setLoading(false);
      Alert.alert('Missing info', 'Please complete required fields.');
      return;
    }

    const payload = {
      business_id: business?.id ?? initialRoute?.business_id ?? null,
      driver_id: selectedDriver?.Profile?.id ?? null, // profile id
      employee_id: selectedDriver?.id ?? null, // employee id
      name: name!.trim(),
      service_date: selectedIso, // YYYY-MM-DD
      status: initialRoute ? initialRoute.status : ('draft' as const),
      planned_start_at: combineISODateAndTimeUTC(selectedIso, plannedStart),
      start_longitude: useBusinessHQ ? 0 : longitude || 0,
      start_latitude: useBusinessHQ ? 0 : latitude || 0,
      tags: tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      notes: notes || null,
      single_day: singleDay,
      optimize: routeOptimize,
    };

    try {
      if (initialRoute?.id) {
        // EDIT EXISTING
        const resp = await updateRouter(initialRoute.id, payload);
        setLoading(false);

        if (!resp.success) {
          throw new Error(
            resp.message || resp.error?.message || 'Update failed',
          );
        }

        Alert.alert('Saved', 'Route updated successfully.');
        nav.goBack();
      } else {
        // CREATE NEW DRAFT
        const draft = await createDraftRoute(payload as any);
        setLoading(false);

        if (draft.success) {
          await notifyRouteDraftCreated({
            businessId: (business?.id ?? payload.business_id)!,
            routeId: draft.data.id,
            routeName: payload.name,
            serviceDateISO: payload.service_date,
            plannedStartISO: payload.planned_start_at,
            creatorProfileId: profile?.id ?? null,
            driverProfileId: selectedDriver?.Profile?.id ?? null,
          });
          nav.navigate('RouteDraftScreen', {
            routeId: draft.data.id,
            payload,
          });
        } else {
          Alert.alert(
            'Error',
            draft.error?.message || 'Failed to create route',
          );
        }
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Something went wrong');
    }
  };

  /* ─────────────── UI ─────────────── */

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
    >
      {/* Header */}
      <View style={tw`px-2 pt-4 pb-4 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2 flex-row items-center justify-between`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            {initialRoute ? 'Edit Route' : 'New Route'}
          </Text>
        </View>
      </View>

      {/* Body (FlatList to avoid nested virtualized lists warnings) */}
      <FlatList
        data={[{ key: 'form' }]}
        keyExtractor={item => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4 pb-8`}
        keyboardShouldPersistTaps="handled"
        renderItem={() => (
          <>
            {/* Header date label */}
            <View style={tw`flex-row items-center mb-2`}>
              <Calendar width={16} height={16} color={colors.text} />
              <Text
                style={[
                  tw`ml-2 text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                {headerTitle}
              </Text>
            </View>

            {/* Basic info */}
            <SectionTitle text="Basic Info" />
            <Field
              label="Route Name "
              value={name}
              onChangeText={setName}
              placeholder="e.g., Tue AM — West"
              colors={colors}
              required
            />

            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`w-[48%]`}>
                <SelectInput
                  label="Driver"
                  selectedValue={selectedDriverLabel}
                  onPress={() => setDriverModalOpen(true)}
                  colors={colors}
                  required
                />
              </View>
              <View style={tw`w-[48%]`}>
                <SelectInput
                  label="Planned Start"
                  selectedValue={plannedStart}
                  onPress={() => setShowTimePicker(true)}
                  colors={colors}
                  required
                />
              </View>
            </View>

            <SectionTitle text="Route Type" />
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Single Shift
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={singleDay}
                onValueChange={setSingleDay}
                thumbColor={singleDay ? colors.primary : '#666'}
              />
            </Row>

            <SectionTitle text="Route Optimization" />
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Optimize Route with Gemini AI
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={routeOptimize}
                onValueChange={setRouteOptimize}
                thumbColor={routeOptimize ? colors.primary : '#666'}
              />
            </Row>

            {/* Starting location (toggle to use HQ or custom) */}

            {/* Toggle for HQ vs. custom */}

            {/* Tags & Notes */}
            <SectionTitle text="Tags & Notes (optional)" />
            <Field
              label="Tags (comma-separated)"
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="priority, westside, morning"
              colors={colors}
              leftIcon={<Tag width={16} height={16} color="#9CA3AF" />}
            />
            <Text style={tw`text-gray-400 text-xs mb-1`}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any instructions or notes for this route..."
              placeholderTextColor={'#9CA3AF'}
              multiline
              numberOfLines={4}
              style={[
                tw`px-3 py-2 rounded-xl mb-6`,
                {
                  color: colors.text,
                  backgroundColor: colors.border,
                  minHeight: 90,
                  textAlignVertical: 'top',
                },
              ]}
            />
          </>
        )}
      />

      {/* Footer CTA */}
      <View style={tw`px-4`}>
        <TouchableOpacity
          onPress={onSave}
          disabled={!valid || loading}
          style={[
            tw`px-4 py-3 rounded-2xl items-center mb-8`,
            {
              backgroundColor: valid ? colors.brand.primary : colors.border,
              opacity: loading ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={tw`text-white font-semibold`}>
              {initialRoute ? 'Save Changes' : 'Create Draft'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      <Modal
        animationType="slide"
        visible={showTimePicker}
        onRequestClose={() => setShowTimePicker(false)}
        transparent
      >
        <View style={tw`flex-1 bg-black/40`}>
          <View
            style={[
              tw`mt-auto rounded-t-3xl p-4`,
              { backgroundColor: colors.main },
            ]}
          >
            <View style={tw`flex-row items-center mb-3`}>
              <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
                Select Time
              </Text>
              <View style={tw`flex-1`} />
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <CloseIcon width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' ? (
              <View style={tw`mt-2 rounded-xl p-2`}>
                <DateTimePicker
                  mode="time"
                  display="spinner"
                  value={new Date(`1970-01-01T${plannedStart}:00`)}
                  onChange={handlePickTime}
                  style={{ alignSelf: 'stretch' }}
                />
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  style={[
                    tw`mt-2 px-4 py-2 rounded-xl self-end`,
                    { backgroundColor: colors.brand?.primary || '#005ad0' },
                  ]}
                >
                  <Text style={tw`text-white font-semibold`}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <DateTimePicker
                mode="time"
                value={new Date(`1970-01-01T${plannedStart}:00`)}
                onChange={handlePickTime}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* DRIVER PICKER MODAL */}
      <DriverPickerModal
        visible={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        drivers={allDrivers}
        selectedId={selectedDriver?.id ?? null}
        onSelect={d => {
          setSelectedDriver(d);
          setDriverModalOpen(false);
        }}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

/* ─────────────── UI bits ─────────────── */

function SectionTitle({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[tw`w-full pb-1`, { borderColor: colors.border }]}>
      <Text
        style={[tw`text-lg font-semibold mt-2 mb-1`, { color: colors.text }]}
      >
        {text}
      </Text>
    </View>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[tw`flex-row`, style]}>{children}</View>;
}
function Spacer() {
  return <View style={tw`w-2`} />;
}
