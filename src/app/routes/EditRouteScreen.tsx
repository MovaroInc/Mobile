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
  GitPullRequest,
  Check,
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
import {
  createDraftRoute,
  grabRouteCount,
  updateDraftRoute,
} from '../../shared/lib/RouteHelpers';
import { CreateInbox } from '../../shared/lib/inboxHelpers';
import { createStop } from '../../shared/lib/StopsHelpers';

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

export function combineISODateAndTimeUTC(isoDate: string, timeStr: string) {
  // isoDate: "YYYY-MM-DD" (local calendar)
  // timeStr: "HH:mm" or "h:mm AM/PM" (may contain narrow/nbsp)
  const safe = (timeStr || '')
    .replace(/\u202F|\u00A0/g, ' ')
    .trim()
    .toUpperCase();

  // Try 12-hour first: "h:mm AM/PM"
  let h: number, m: number;
  let m12 = safe.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    h = parseInt(m12[1], 10) % 12;
    if (m12[3] === 'PM') h += 12; // 12h -> 24h
    m = parseInt(m12[2], 10);
  } else {
    // Fallback 24-hour: "HH:mm"
    const m24 = safe.match(/^(\d{1,2}):(\d{2})$/);
    if (!m24) throw new Error(`Invalid time: ${timeStr}`);
    h = parseInt(m24[1], 10);
    m = parseInt(m24[2], 10);
  }

  const [y, mo, d] = isoDate.split('-').map(Number); // local calendar
  const local = new Date(y, (mo ?? 1) - 1, d ?? 1, h, m, 0, 0); // constructs in local TZ (handles DST)
  return local.toISOString(); // UTC ISO (timestamptz-friendly)
}

function toHHmm(d: Date) {
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

export function localYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EditRouteScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { business, profile } = useSession();
  const { route } = params as RouteParams;
  const items = buildDateRange(8); // today + next 7
  const initialISO =
    (params as RouteParams)?.serviceDateISO ??
    (items[0]?.iso || new Date().toISOString().slice(0, 10));

  const [name, setName] = useState<string | null>(route.name);
  const [selectedIso] = useState(initialISO);

  // Time picker
  const [plannedStart, setPlannedStart] = useState(
    new Date(route.planned_start_at).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit', // no seconds
      hour12: true, // or false for 24h
    }),
  ); // HH:mm
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Drivers
  const [allDrivers, setAllDrivers] = useState<Employee[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Employee | null>(
    route.driver,
  );
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState(route.notes);

  // Address search
  const [latitude, setLatitude] = useState(route.start_latitude);
  const [longitude, setLongitude] = useState(route.start_longitude);
  const [singleDay, setSingleDay] = useState(true);
  const [routeOptimize, setRouteOptimize] = useState(route.optimize);

  const [driverDisplay, setDriverDisplay] = useState('full');
  const [autoTriggerStops, setAutoTriggerStops] = useState(
    route.auto_trigger_stops,
  );

  const [loading, setLoading] = useState(false);

  const [endBase, setEndBase] = useState(route.end_base);
  const [startBase, setStartBase] = useState(route.start_base);
  const [breaksAmount, setBreaksAmount] = useState(
    route.allowed_breaks.toString(),
  );

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
  const normalizeTime = (s: string) => s?.replace(/\u202F|\u00A0/g, ' ').trim();
  const valid = useMemo(() => {
    const t = normalizeTime(plannedStart || '');
    if (!name?.trim()) return false;
    if (!selectedIso) return false;
    if (!selectedDriver?.id) return false;

    // Accept "09:00" or "9:00 AM" / "9:00AM"
    const ok = /^\d{2}:\d{2}$/.test(t) || /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(t);

    return ok;
  }, [name, selectedIso, selectedDriver?.id, plannedStart]);

  function todayLocalYYYYMMDD(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${day}-${m}`;
  }

  const onNext = async () => {
    console.log('selectedDriver', selectedDriver);
    setLoading(true);
    if (!valid) {
      console.log('invalid');
      Alert.alert('Missing info', 'Please complete required fields.');
      return;
    }
    console.log('valid');
    const time = combineISODateAndTimeUTC(selectedIso, plannedStart);
    console.log('time', time);

    const payload = {
      business_id: business?.id ?? null,
      driver_id: selectedDriver?.id ?? null, // profile id (if your table expects it)
      employee_id: selectedDriver?.employee_id ?? null, // employee id
      name: name!.trim(),
      service_date: todayLocalYYYYMMDD(), // YYYY-MM-DD
      status: 'draft' as const,
      planned_start_at: combineISODateAndTimeUTC(selectedIso, plannedStart),
      start_longitude: longitude || 0,
      start_latitude: latitude || 0,
      tags: tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      notes: notes || null,
      single_day: singleDay,
      optimize: routeOptimize,
      driver_display: driverDisplay ? 'full' : 'single',
      auto_trigger_stops: autoTriggerStops,
      allowed_breaks: parseInt(breaksAmount),
      end_base: endBase,
      start_base: startBase,
    };

    console.log('payload', payload);
    const draft = await updateDraftRoute(payload, route.id);
    console.log('draft', draft);
    if (draft.error) {
      Alert.alert('Error', draft.error.message);
      return;
    }
    setLoading(false);
    nav.goBack();
  };

  const handlePickTime = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPlannedStart(toHHmm(selected));
    if (Platform.OS === 'android') setShowTimePicker(false);
  };

  const selectedDriverLabel = useMemo(() => {
    if (!selectedDriver) return 'Select';
    const fn = selectedDriver?.first_name?.trim() ?? '';
    const ln = selectedDriver?.last_name?.trim() ?? '';
    const full = `${fn} ${ln}`.trim();
    return full || 'Select';
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
            Edit Route
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

            <SectionTitle text="Route Optimization" />
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Auto Optimize Route with Gemeni AI
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={routeOptimize}
                onValueChange={setRouteOptimize}
                thumbColor={routeOptimize ? colors.primary : '#666'}
              />
            </Row>

            <SectionTitle text="Route Start/End" />
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                Start the drivers route at HQ / Base
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={startBase}
                onValueChange={setStartBase}
                thumbColor={startBase ? colors.primary : '#666'}
              />
            </Row>
            <Row style={tw`items-center mb-2`}>
              <MapPin width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2`, { color: colors.text }]}>
                End the drivers route at HQ / Base
              </Text>
              <View style={tw`flex-1`} />
              <Switch
                value={endBase}
                onValueChange={setEndBase}
                thumbColor={endBase ? colors.primary : '#666'}
              />
            </Row>

            <SectionTitle text="Route Display" />
            <Row style={tw`items-center mb-2`}>
              <View style={tw`flex-row items-start`}>
                <GitPullRequest width={16} height={16} color="#9CA3AF" />
                <View style={tw`ml-2`}>
                  <Text style={[tw``, { color: colors.text }]}>
                    Display Entire Route
                  </Text>
                  {driverDisplay === 'full' ? (
                    <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
                      Disable to show 1 stop at a time for drivers
                    </Text>
                  ) : (
                    <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
                      Enable to show the full route for drivers
                    </Text>
                  )}
                </View>
              </View>

              <View style={tw`flex-1`} />
              <Switch
                value={driverDisplay === 'full'}
                onValueChange={() =>
                  setDriverDisplay(driverDisplay === 'full' ? 'single' : 'full')
                }
                thumbColor={driverDisplay === 'full' ? colors.primary : '#666'}
              />
            </Row>

            <SectionTitle text="Auto Trigger Stops" />
            <Row style={tw`items-center mb-2`}>
              <Check width={16} height={16} color="#9CA3AF" />
              <Text style={[tw`ml-2 flex-1`, { color: colors.text }]}>
                Automatically trigger next stop
              </Text>
              <View style={tw``} />
              <Switch
                value={autoTriggerStops}
                onValueChange={setAutoTriggerStops}
                thumbColor={autoTriggerStops ? colors.primary : '#666'}
              />
            </Row>

            <SectionTitle text="Breaks" />
            <Field
              label="Allowed Breaks"
              value={breaksAmount}
              onChangeText={setBreaksAmount}
              placeholder="0"
              colors={colors}
              leftIcon={<Clock width={16} height={16} color="#9CA3AF" />}
            />

            {/* Starting location */}
            <SectionTitle text="Route Notes (optional)" />
            {/* Tags & Notes */}
            {/* <SectionTitle text="Tags & Notes (optional)" />
            <Field
              label="Tags (comma-separated)"
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="priority, westside, morning"
              colors={colors}
              leftIcon={<Tag width={16} height={16} color="#9CA3AF" />}
            /> */}
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
            <Text style={tw`text-white font-semibold`}>Update</Text>
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
