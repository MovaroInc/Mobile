import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import tw from 'twrnc';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  ChevronLeft,
  Clock,
  Calendar,
  List as ListIcon,
  CheckSquare,
  UserCheck,
  Truck as LiftgateIcon,
  Key as AccessIcon,
  DollarSign,
  Hash,
  X as CloseIcon,
  FileText,
  Edit,
  Clipboard,
  Check,
} from 'react-native-feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import Field from '../../shared/components/inputs/Field';
import {
  createStopsPayments,
  createStopsRequirements,
  updateStop,
} from '../../shared/lib/StopsHelpers';
import { useSession } from '../../state/useSession';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RouteParams = {
  routeId: number;
  step1: {
    route_id: number;
    type: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    region: string;
    postal_code: string | null;
    country_code: string;
    latitude: number | null;
    longitude: number | null;

    // optional from screen 1 if you included them
    customer_id?: number | null;
    vendor_id?: number | null;
    one_time?: {
      name: string;
      phone?: string | null;
      email?: string | null;
    } | null;
  };
  // optional optimization so we can default “position” nicely
  stopsCount?: number;
};

function toHHmm(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function AddStopScreen2() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();
  const { params } = useRoute<any>();
  const { routeId, step1, stopId, stopsCount = 0 } = params as RouteParams;
  console.log('stopsCount', stopsCount);
  console.log('routeId', routeId);

  /** ── Position (sequence) ───────────────────────────────────── */
  // Position choices: 'start' | 'end' | 'after'
  const [positionMode, setPositionMode] = useState<'start' | 'end' | 'after'>(
    'end',
  );
  const [afterIndex, setAfterIndex] = useState<string>(String(stopsCount)); // 1..N (insert after #)
  const sequenceHint = useMemo(() => {
    if (positionMode === 'start') return 'Insert as #1';
    if (positionMode === 'end') return `Append as #${stopsCount + 1}`;
    const parsed = Math.max(
      1,
      Math.min(stopsCount, Number(afterIndex) || stopsCount),
    );
    return `Insert after #${parsed} → becomes #${parsed + 1}`;
  }, [positionMode, stopsCount, afterIndex]);

  /** ── Schedule ─────────────────────────────────────────────── */
  const [serviceMinutes, setServiceMinutes] = useState('10');
  const [windowStart, setWindowStart] = useState<string>(''); // HH:mm
  const [windowEnd, setWindowEnd] = useState<string>(''); // HH:mm
  const [hardWindow, setHardWindow] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  /** ── Requirements ─────────────────────────────────────────── */
  const [giveInvoice, setGiveInvoice] = useState(false);
  const [printName, setPrintName] = useState(false);
  const [contactless, setContactless] = useState(false);
  const [contactBefore, setContactBefore] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState();
  // step1.type === 'delivery',
  const [photosRequired, setPhotosRequired] = useState(true);
  const [checklistRequired, setChecklistRequired] = useState();
  // step1.type === 'service' ||
  //   step1.type === 'install' ||
  //   step1.type === 'repair',
  const [twoPerson, setTwoPerson] = useState(false);
  const [liftgate, setLiftgate] = useState(false);
  const [dockAppt, setDockAppt] = useState(false);
  const [idCheck, setIdCheck] = useState(false); // alcohol
  const [tempControl, setTempControl] = useState(false); // pharmacy
  const [accessCode, setAccessCode] = useState('');
  const [accessInfo, setAccessInfo] = useState('');
  const [notes, setNotes] = useState('');
  /** ── Payment ──────────────────────────────────────────────── */
  const [paymentExpected, setPaymentExpected] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'check' | 'other'>(
    'cash',
  );
  const [reference, setReference] = useState(''); // invoice/PO
  const [paymentNotes, setPaymentNotes] = useState('');

  /** ── Derived & Validation ─────────────────────────────────── */
  const canContinue = useMemo(() => {
    // If hard window, both start & end should exist
    if (hardWindow && (!windowStart || !windowEnd)) return false;
    // If payment expected, need at least amount
    if (paymentExpected && !amount.trim()) return false;
    return true;
  }, [hardWindow, windowStart, windowEnd, paymentExpected, amount]);

  /** ── Handlers ─────────────────────────────────────────────── */
  const openStartPicker = () => setShowStartPicker(true);
  const openEndPicker = () => setShowEndPicker(true);

  const toBool = (v: any) => v === true || v === 'true' || v === 1 || v === '1';

  useFocusEffect(
    useCallback(() => {
      loadStep2FromStorage();
    }, []),
  );

  const loadStep2FromStorage = async () => {
    try {
      const raw = await AsyncStorage.getItem('step2Payload');
      if (!raw) return;

      const p = JSON.parse(raw) ?? {};

      // ── Position / sequence
      const mode = p?.position?.mode;
      if (mode === 'start' || mode === 'end' || mode === 'after') {
        setPositionMode(mode);
      }
      // If you later support "after", you can also set afterIndex here
      // if (mode === 'after' && Number.isFinite(p.sequence)) {
      //   setAfterIndex(String(Math.max(1, Number(p.sequence))));
      // }

      // ── Window / schedule
      const w = p?.window ?? {};
      if (w.planned_service_minutes != null) {
        setServiceMinutes(String(w.planned_service_minutes));
      }
      if (w.window_start != null) setWindowStart(w.window_start || '');
      if (w.window_end != null) setWindowEnd(w.window_end || '');
      if (w.hard_window != null) setHardWindow(toBool(w.hard_window));

      // ── Requirements (prefer canonical keys, fall back to legacy ones)
      const r = p?.requirements ?? {};

      if (r.give_invoice != null) setGiveInvoice(toBool(r.give_invoice));
      if (r.print_name != null) setPrintName(toBool(r.print_name));
      if (r.contactless != null) setContactless(toBool(r.contactless));
      if (r.contact_before != null) setContactBefore(toBool(r.contact_before));

      const sig = r.signature_required ?? r.signature;
      if (sig != null) setSignatureRequired(toBool(sig));

      const photos =
        r.photos_required ??
        r.require_photo_products ??
        r.require_photo_invoice;
      if (photos != null) setPhotosRequired(toBool(photos));

      const checklist = r.checklist_required ?? r.checlist_required; // (typo fallback)
      if (checklist != null) setChecklistRequired(toBool(checklist));

      const two = r.two_person_required ?? r.two_person;
      if (two != null) setTwoPerson(toBool(two));

      const lift = r.liftgate_needed ?? r.lift_gate_required;
      if (lift != null) setLiftgate(toBool(lift));

      if (r.dock_appointment != null) setDockAppt(toBool(r.dock_appointment));

      const idchk = r.id_check ?? r.id_required;
      if (idchk != null) setIdCheck(toBool(idchk));

      const temp = r.temperature_control ?? r.temp_control;
      if (temp != null) setTempControl(toBool(temp));

      if (r.access_code != null) setAccessCode(String(r.access_code ?? ''));
      if (r.access_info != null) setAccessInfo(String(r.access_info ?? ''));
      if (r.notes != null) setNotes(String(r.notes ?? ''));

      // ── Payment
      const pay = p?.payment ?? {};
      if (pay.expected != null) setPaymentExpected(toBool(pay.expected));
      if (pay.amount != null) setAmount(String(pay.amount));
      if (pay.method != null) setMethod(pay.method);
      if (pay.reference != null) setReference(String(pay.reference ?? ''));
      if (pay.notes != null) setPaymentNotes(String(pay.notes ?? ''));
    } catch (e) {
      console.log('loadStep2FromStorage error', e);
    }
  };

  const onNext = async () => {
    if (!canContinue) return;

    const position =
      positionMode === 'start'
        ? { mode: 'start' as const }
        : { mode: 'end' as const };

    const step2Payload = {
      position, //
      sequence: positionMode === 'start' ? 0 : stopsCount + 1,
      window: {
        planned_service_minutes: Number(serviceMinutes) || 10,
        window_start: windowStart || null,
        window_end: windowEnd || null,
        hard_window: hardWindow,
      },
      requirements: {
        give_invoice: giveInvoice,
        signature: signatureRequired,
        print_name: printName,
        contactless,
        access_info: accessInfo,
        require_photo_products: photosRequired,
        require_photo_invoice: photosRequired,
        contact_before: contactBefore,
        collect_payment: paymentExpected,
        id_required: idCheck,
        checlist_required: checklistRequired,
        two_person: twoPerson,
        lift_gate_required: liftgate,
        dock_appointment: dockAppt,
        temp_control: tempControl,
        access_code: accessCode,
        notes,
        signature_required: signatureRequired,
        photos_required: photosRequired,
        checklist_required: checklistRequired,
        two_person_required: twoPerson,
        liftgate_needed: liftgate,
        id_check: idCheck,
        temperature_control: tempControl,
      },
      payment: {
        expected: true,
        amount: Number(amount),
        method,
        reference: reference || null,
        notes: paymentNotes || null,
      },
    };

    await AsyncStorage.setItem('step2Payload', JSON.stringify(step2Payload));

    nav.navigate('AddStopScreen3', { routeId, stopsCount });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
    >
      {/* Header */}
      <View style={tw`px-2 pt-4 pb-2 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            Add Stop
          </Text>
          <Text style={[tw`text-xs mt-0.5`, { color: colors.muted }]}>
            Step 2 of 3 — Schedule, Requirements & Payment
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4 pb-28`}
      >
        {/* Position */}
        <Text style={[tw`text-lg font-semibold mb-2`, { color: colors.text }]}>
          Position
        </Text>
        <View style={tw`flex-row mb-2`}>
          <ToggleChip
            active={positionMode === 'start'}
            onPress={() => setPositionMode('start')}
            label="Start"
            colors={colors}
          />
          <View style={tw`w-2`} />
          <ToggleChip
            active={positionMode === 'end'}
            onPress={() => setPositionMode('end')}
            label="End"
            colors={colors}
          />
        </View>

        {positionMode === 'after' && (
          <View style={tw`flex-row items-center mb-2`}>
            <Hash width={16} height={16} color={colors.muted} />
            <TextInput
              value={afterIndex}
              onChangeText={setAfterIndex}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={'#9CA3AF'}
              style={[
                tw`ml-2 flex-1 px-3 py-2 rounded-xl`,
                { backgroundColor: colors.border, color: colors.text },
              ]}
            />
          </View>
        )}
        <Text style={[tw`text-2xs mb-3`, { color: colors.muted }]}>
          {sequenceHint}
        </Text>

        {/* Schedule */}
        <Text style={[tw`text-lg font-semibold mb-2`, { color: colors.text }]}>
          Schedule
        </Text>
        <ReqRow
          Icon={Clock}
          label="Hard Window"
          value={hardWindow}
          onValueChange={setHardWindow}
          colors={colors}
          description="Require arrival within a specific time window."
        />
        {hardWindow && (
          <View style={tw`flex-row`}>
            <View style={tw`flex-1 mr-2`}>
              <Text style={tw`text-gray-400 text-xs mb-1`}>Window Start</Text>
              <TouchableOpacity
                onPress={openStartPicker}
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Clock width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {windowStart || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-gray-400 text-xs mb-1`}>Window End</Text>
              <TouchableOpacity
                onPress={openEndPicker}
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.border },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Clock width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {windowEnd || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={tw`text-gray-400 text-xs mb-1 mt-3`}>
          Expected Service Time (min)
        </Text>
        <View
          style={[
            tw`px-3 py-2 rounded-xl flex-row items-center`,
            { backgroundColor: colors.border },
          ]}
        >
          <TextInput
            value={serviceMinutes}
            onChangeText={setServiceMinutes}
            keyboardType="numeric"
            placeholder="10"
            placeholderTextColor={'#9CA3AF'}
            style={[tw`flex-1`, { color: colors.text, padding: 0 }]}
          />
        </View>

        <Text
          style={[tw`text-lg font-semibold mb-2 mt-4`, { color: colors.text }]}
        >
          Requirements
        </Text>

        <ReqRow
          Icon={FileText}
          label="Give Invoice"
          value={giveInvoice}
          onValueChange={setGiveInvoice}
          colors={colors}
          description="Hand invoice to recipient."
        />
        <ReqRow
          Icon={Edit}
          label="Print Name"
          value={printName}
          onValueChange={setPrintName}
          colors={colors}
          description="Print recipient name on invoice."
        />
        <ReqRow
          Icon={CheckSquare}
          label="Signature Required"
          value={signatureRequired}
          onValueChange={setSignatureRequired}
          colors={colors}
          description="Require signature from recipient."
        />

        <ReqRow
          Icon={ListIcon}
          label="Photos Required"
          value={photosRequired}
          onValueChange={setPhotosRequired}
          colors={colors}
          description="Take proof-of-delivery photos."
        />
        <ReqRow
          Icon={UserCheck}
          label="Checklist Required"
          value={checklistRequired}
          onValueChange={setChecklistRequired}
          colors={colors}
          description="Complete the item checklist."
        />

        <Text
          style={[tw`text-lg font-semibold mt-4 mb-2`, { color: colors.text }]}
        >
          Pre-Arrival Requirements
        </Text>

        <ReqRow
          Icon={Check}
          label="Contact Before"
          value={contactBefore}
          onValueChange={setContactBefore}
          colors={colors}
          description="Contact recipient before arrival."
        />

        <ReqRow
          Icon={Clipboard}
          label="Contactless"
          value={contactless}
          onValueChange={setContactless}
          colors={colors}
          description="Leave at door; no contact required."
        />
        <ReqRow
          Icon={UserCheck}
          label="ID Check (21+)"
          value={idCheck}
          onValueChange={setIdCheck}
          colors={colors}
          description="Verify recipient’s photo ID."
        />
        <ReqRow
          Icon={UserCheck}
          label="Two-person Assist"
          value={twoPerson}
          onValueChange={setTwoPerson}
          colors={colors}
          description="Two people required to handle."
        />
        <ReqRow
          Icon={LiftgateIcon}
          label="Liftgate Needed"
          value={liftgate}
          onValueChange={setLiftgate}
          colors={colors}
          description="Liftgate needed for unloading."
        />
        <ReqRow
          Icon={Calendar}
          label="Dock Appointment"
          value={dockAppt}
          onValueChange={setDockAppt}
          colors={colors}
          description="Confirm dock time before arrival."
        />
        <ReqRow
          Icon={UserCheck}
          label="Temperature Control"
          value={tempControl}
          onValueChange={setTempControl}
          colors={colors}
          description="Maintain required temperature range."
        />

        <Text style={tw`text-gray-400 text-xs mb-1 mt-2`}>Access Code</Text>
        <View
          style={[tw`px-3 py-2 rounded-xl`, { backgroundColor: colors.border }]}
        >
          <TextInput
            value={accessCode}
            onChangeText={setAccessCode}
            placeholder="Gate code, parking, hazards…"
            placeholderTextColor={'#9CA3AF'}
            style={[{ color: colors.text, padding: 0 }]}
          />
        </View>

        <Text style={tw`text-gray-400 text-xs mb-1 mt-2`}>Access Info</Text>
        <View
          style={[tw`px-3 py-2 rounded-xl`, { backgroundColor: colors.border }]}
        >
          <TextInput
            value={accessInfo}
            onChangeText={setAccessInfo}
            placeholder="Gate code, parking, hazards…"
            placeholderTextColor={'#9CA3AF'}
            style={[{ color: colors.text, padding: 0 }]}
          />
        </View>

        <Text style={tw`text-gray-400 text-xs mb-1 mt-2`}>Overall Notes</Text>
        <View
          style={[
            tw`px-3 py-2 rounded-xl mb-6`,
            { backgroundColor: colors.border },
          ]}
        >
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional instructions…"
            placeholderTextColor={'#9CA3AF'}
            style={[{ color: colors.text, padding: 0 }]}
          />
        </View>

        {/* Requirements */}

        <Text
          style={[tw`text-lg font-semibold mt-4 mb-2`, { color: colors.text }]}
        >
          Payment
        </Text>

        {/* Payment */}
        <ReqRow
          Icon={DollarSign}
          label="Payment Expected"
          value={paymentExpected}
          onValueChange={setPaymentExpected}
          colors={colors}
          description="Require payment transaction."
        />

        {paymentExpected && (
          <>
            <Text style={tw`text-gray-400 text-xs mb-1`}>Invoice Amount</Text>
            <View
              style={[
                tw`px-3 py-2 rounded-xl flex-row items-center`,
                { backgroundColor: colors.border },
              ]}
            >
              <DollarSign width={16} height={16} color="#9CA3AF" />
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={'#9CA3AF'}
                style={[tw`ml-2 flex-1`, { color: colors.text, padding: 0 }]}
              />
            </View>

            <Text style={[tw`text-gray-400 text-xs mb-1 mt-3`]}>Method</Text>
            <View
              style={[
                tw`flex-row p-1 rounded-xl mb-2`,
                { backgroundColor: colors.border },
              ]}
            >
              {(['cash', 'card', 'check', 'zelle'] as const).map(k => {
                const active = method === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setMethod(k)}
                    style={[
                      tw`flex-1 px-3 py-2 rounded-lg items-center`,
                      {
                        backgroundColor: active
                          ? colors.brand?.primary || '#2563eb'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-sm font-semibold`,
                        { color: active ? '#fff' : colors.text },
                      ]}
                    >
                      {k.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field
              label="Invoice / PO / Ref"
              value={reference}
              onChangeText={setReference}
              colors={colors}
              leftIcon={<Hash width={16} height={16} color="#9CA3AF" />}
            />

            <Text style={tw`text-gray-400 text-xs mb-1`}>Payment Notes</Text>
            <View
              style={[
                tw`px-3 py-2 rounded-xl`,
                { backgroundColor: colors.border },
              ]}
            >
              <TextInput
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                placeholder="Any payment instructions…"
                placeholderTextColor={'#9CA3AF'}
                multiline
                numberOfLines={3}
                style={[
                  {
                    color: colors.text,
                    minHeight: 70,
                    textAlignVertical: 'top',
                    padding: 0,
                  },
                ]}
              />
            </View>
          </>
        )}

        {/* Next CTA */}
        <TouchableOpacity
          disabled={!canContinue}
          onPress={onNext}
          style={[
            tw`mt-6 px-4 py-3 rounded-2xl items-center`,
            {
              backgroundColor: canContinue
                ? colors.brand?.primary || '#2563eb'
                : colors.border,
            },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>Next: Photos</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Time pickers in a bottom sheet style for iOS (Android uses default inline modal) */}
      <Modal
        animationType="slide"
        transparent
        visible={showStartPicker}
        onRequestClose={() => setShowStartPicker(false)}
      >
        <View style={tw`flex-1 bg-black/40`}>
          <View
            style={[
              tw`mt-auto rounded-t-3xl p-4`,
              { backgroundColor: colors.main },
            ]}
          >
            <View style={tw`flex-row items-center mb-2`}>
              <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
                Select Start
              </Text>
              <View style={tw`flex-1`} />
              <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                <CloseIcon width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              value={new Date(`1970-01-01T${windowStart || '08:00'}:00`)}
              onChange={(_, d) => {
                if (d) setWindowStart(toHHmm(d));
                if (Platform.OS === 'android') setShowStartPicker(false);
              }}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowStartPicker(false)}
                style={[
                  tw`mt-2 px-4 py-2 rounded-xl self-end`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <Text style={tw`text-white font-semibold`}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showEndPicker}
        onRequestClose={() => setShowEndPicker(false)}
      >
        <View style={tw`flex-1 bg-black/40`}>
          <View
            style={[
              tw`mt-auto rounded-t-3xl p-4`,
              { backgroundColor: colors.main },
            ]}
          >
            <View style={tw`flex-row items-center mb-2`}>
              <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
                Select End
              </Text>
              <View style={tw`flex-1`} />
              <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                <CloseIcon width={22} height={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              value={new Date(`1970-01-01T${windowEnd || '09:00'}:00`)}
              onChange={(_, d) => {
                if (d) setWindowEnd(toHHmm(d));
                if (Platform.OS === 'android') setShowEndPicker(false);
              }}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowEndPicker(false)}
                style={[
                  tw`mt-2 px-4 py-2 rounded-xl self-end`,
                  { backgroundColor: colors.brand?.primary || '#2563eb' },
                ]}
              >
                <Text style={tw`text-white font-semibold`}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/** Small UI bits */

function ToggleChip({
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
        tw`px-3 py-2 rounded-lg items-center justify-center flex-1`,
        {
          backgroundColor: active
            ? colors.brand?.primary || '#2563eb'
            : colors.border,
        },
      ]}
    >
      <Text
        style={[
          tw`text-sm font-semibold`,
          { color: active ? '#fff' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ReqRow({
  Icon,
  label,
  value,
  onValueChange,
  colors,
  description,
}: {
  Icon: any;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
  description: string;
}) {
  return (
    <View
      style={[
        tw`px-3 py-2 rounded-xl mb-2`,
        { backgroundColor: colors.border },
      ]}
    >
      <View
        style={[
          tw`flex-row items-center justify-between rounded-xl mb-2`,
          { backgroundColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center`}>
          <Icon width={16} height={16} color="#9CA3AF" />
          <Text style={[tw`ml-2`, { color: colors.text }]}>{label}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          thumbColor={value ? colors.primary : '#666'}
        />
      </View>
      <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
        {description}
      </Text>
    </View>
  );
}
