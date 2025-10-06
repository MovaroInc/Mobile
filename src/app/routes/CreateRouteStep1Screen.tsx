// src/app/routes/CreateRouteStep1Screen.tsx
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
  Clock,
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
import { createDraftRoute } from '../../shared/lib/RouteHelpers';
import { CreateInbox } from '../../shared/lib/inboxHelpers';

type RouteParams = Partial<{
  driverId: number | null;
  serviceDateISO: string | null;
}>;

type Employee = {
  id: number;
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

export function combineISODateAndTimeUTC(isoDate: string, timeHHmm: string) {
  // isoDate: 'YYYY-MM-DD' in LOCAL calendar
  // timeHHmm: 'HH:mm' in LOCAL time
  const [y, mo, d] = isoDate.split('-').map(Number);
  const [h = 0, m = 0] = timeHHmm.split(':').map(Number);

  // Construct a local time (device timezone). JS Date will apply DST correctly.
  const local = new Date(y, (mo ?? 1) - 1, d ?? 1, h, m, 0, 0);

  // Return UTC ISO string (with 'Z')
  return local.toISOString();
}

function toHHmm(d: Date) {
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

export default function CreateRouteStep1Screen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { business, profile } = useSession();

  const items = buildDateRange(8); // today + next 7
  const initialISO =
    (params as RouteParams)?.serviceDateISO ??
    (items[0]?.iso || new Date().toISOString().slice(0, 10));

  const [name, setName] = useState<string | null>(`New Route`);
  const [selectedIso] = useState(initialISO);

  // Time picker
  const [plannedStart, setPlannedStart] = useState('08:00'); // HH:mm
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Drivers
  const [allDrivers, setAllDrivers] = useState<Employee[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Employee | null>(null);
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  // Depot/Base
  const [useBusinessHQ, setUseBusinessHQ] = useState(true);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('US');

  // Tags & Notes
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  // Address search
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);

  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    if (!business?.id) return;
    (async () => {
      const res = await getDrivers(business.id);
      setAllDrivers(res?.data ?? []);
    })();
  }, [business?.id]);

  // Preselect driver when params or driver list changes
  useEffect(() => {
    if (!allDrivers.length) return;
    const fromParams = (params as RouteParams)?.driverId;
    if (fromParams != null) {
      const d = allDrivers.find(x => x.id === fromParams) || null;
      setSelectedDriver(d);
    } else if (!selectedDriver) {
      setSelectedDriver(allDrivers[0] ?? null);
    }
  }, [params, allDrivers, selectedDriver]);

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

  const valid = useMemo(() => {
    if (!name?.trim()) return false;
    if (!selectedIso) return false;
    if (!selectedDriver?.id) return false;
    if (!plannedStart || !/^\d{2}:\d{2}$/.test(plannedStart)) return false;
    if (!useBusinessHQ) {
      if (!line1.trim() || !city.trim() || !region.trim()) {
        return false;
      }
    }
    return true;
  }, [
    name,
    selectedIso,
    selectedDriver?.id,
    plannedStart,
    useBusinessHQ,
    line1,
    city,
    region,
  ]);

  // Address selection → decompose & geocode
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
        setLatitude(parseFloat(res.data.latitude));
        setLongitude(parseFloat(res.data.longitude));
      } catch {}
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
    } catch (error) {
      console.error(error);
      Alert.alert('Error searching business addresses.');
    }
  };

  const notifyRouteDraftCreated = async ({
    businessId,
    routeId,
    routeName,
    serviceDateISO,
    plannedStartISO,
    creatorProfileId,
    driverProfileId,
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
    };

    // Notify creator/manager
    await CreateInbox({
      ...basePayload,
      profile_id: creatorProfileId,
      dedupe_key: `route.draft.created:${routeId}:${creatorProfileId}`,
    });

    // Notify assigned driver (if any)
    if (driverProfileId) {
      await CreateInbox({
        ...basePayload,
        title: 'YA new route (draft) was created',
        body: `“${routeName}” (${serviceDateISO}) has been assigned.`,
        profile_id: driverProfileId,
        dedupe_key: `route.draft.created:${routeId}:${driverProfileId}`,
      });
    }
  };

  const onNext = async () => {
    setLoading(true);
    if (!valid) {
      Alert.alert('Missing info', 'Please complete required fields.');
      return;
    }

    const payload = {
      business_id: business?.id ?? null,
      driver_id: selectedDriver?.Profile?.id ?? null, // profile id (if your table expects it)
      employee_id: selectedDriver?.id ?? null, // employee id
      name: name!.trim(),
      service_date: selectedIso, // YYYY-MM-DD
      status: 'draft' as const,
      planned_start_at: combineISODateAndTimeUTC(selectedIso, plannedStart),
      start_longitude: longitude || 0,
      start_latitude: latitude || 0,
      tags: tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      notes: notes || null,
    };

    const draft = await createDraftRoute(payload);

    console.log('draft', draft);
    setLoading(false);
    if (draft.success) {
      await notifyRouteDraftCreated({
        businessId: business!.id,
        routeId: draft.data.id,
        routeName: payload.name,
        serviceDateISO: payload.service_date,
        plannedStartISO: payload.planned_start_at,
        creatorProfileId: profile?.id ?? null, // <-- your current user's profile id
        driverProfileId: selectedDriver?.Profile?.id ?? null,
      });
      nav.navigate('RouteDraftScreen', {
        routeId: draft.data.id,
        payload,
      });
    } else {
      Alert.alert('Error', draft.error.message);
    }
  };

  const handlePickTime = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPlannedStart(toHHmm(selected));
    if (Platform.OS === 'android') setShowTimePicker(false);
  };

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[tw`flex-1 `, { backgroundColor: colors.bg }]}
    >
      {/* Header */}
      <View style={tw`px-2 pt-4 pb-4 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2 flex-row items-center justify-between`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            New Route
          </Text>
        </View>
      </View>

      {/* Use FlatList so inner virtualized lists (e.g., suggestions) aren’t nested inside a ScrollView */}
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

            {/* Starting location */}
            <SectionTitle text="Starting Location" />
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Use Business HQ
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={useBusinessHQ}
                onValueChange={setUseBusinessHQ}
                thumbColor={useBusinessHQ ? colors.primary : '#666'}
              />
            </Row>

            {!useBusinessHQ && (
              <>
                {line1.length === 0 &&
                  city.length === 0 &&
                  region.length === 0 && (
                    <FieldSuggestions
                      label="Auto Search Address"
                      value={query}
                      onChangeText={handleSearchAddress}
                      colors={colors}
                      suggestions={suggestions}
                      setSuggestions={setSuggestions}
                      setQuery={setQuery}
                      setAddress={setAddress}
                    />
                  )}

                {line1.length > 0 && city.length > 0 && region.length > 0 && (
                  <>
                    <Field
                      label="Address Line 1 "
                      value={line1}
                      onChangeText={setLine1}
                      colors={colors}
                      required
                    />
                    <Field
                      label="Address Line 2"
                      value={line2}
                      onChangeText={setLine2}
                      colors={colors}
                    />
                    <Row>
                      <Field
                        flex
                        label="City "
                        value={city}
                        onChangeText={setCity}
                        colors={colors}
                        required
                      />
                      <Spacer />
                      <Field
                        flex
                        label="State/Region "
                        value={region}
                        onChangeText={setRegion}
                        colors={colors}
                        required
                      />
                    </Row>
                    <Row>
                      <Field
                        flex
                        label="Postal Code"
                        value={postal}
                        onChangeText={setPostal}
                        colors={colors}
                      />
                      <Spacer />
                      <Field
                        flex
                        label="Country"
                        value={country}
                        onChangeText={() => {}}
                        colors={colors}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </Row>
                  </>
                )}
              </>
            )}

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

            {/* Footer CTA */}
          </>
        )}
      />
      <View style={tw`px-4`}>
        <TouchableOpacity
          onPress={onNext}
          disabled={!valid}
          style={[
            tw`px-4 py-3 rounded-2xl items-center mb-8`,
            {
              backgroundColor: valid ? colors.brand.primary : colors.border,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={tw`text-white font-semibold`}>Next</Text>
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

/** UI bits */
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
