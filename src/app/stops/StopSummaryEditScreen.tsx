// src/app/routes/StopSummaryEditScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import tw from 'twrnc';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  ChevronLeft,
  Edit3,
  Save as SaveIcon,
  X as CloseIcon,
  Clock,
  DollarSign,
  MapPin,
  User,
  CheckSquare,
  FileText,
  Edit,
  Clipboard,
  Truck as LiftgateIcon,
  Calendar,
} from 'react-native-feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import Field from '../../shared/components/inputs/Field';
import { useSession } from '../../state/useSession';

// NOTE: wire these to your actual helpers.
// If your existing functions are named `createStopsRequirements/Payments` and behave as UPSERTs,
// you can import and use them directly.
import {
  updateStop, // (stopId, partial) -> PATCH stops
  createStopsRequirements, // (payload) -> UPSERT stop_requirements
  createStopsPayments, // (payload) -> UPSERT stop_payments
} from '../../shared/lib/StopsHelpers';

type RouteParams = {
  stop: any; // full stop object with joins: requirements, payments/payments[0]
};

function toHHmm(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function StopSummaryEditScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();
  const { params } = useRoute<any>();
  const { stop: incoming } = params as RouteParams;

  // Normalize joined children (support alias `requirements` and `payments` or `payment`)
  const initialReq = useMemo(() => {
    const r =
      (Array.isArray(incoming?.requirements) && incoming.requirements[0]) ||
      incoming?.requirements ||
      null;
    return {
      id: r?.id ?? null,
      stop_id: incoming?.id,
      business_id: incoming?.business_id,
      // Booleans
      give_invoice: !!r?.give_invoice,
      print_name: !!r?.print_name,
      contactless: !!r?.contactless,
      contact_before: !!r?.contact_before,
      signature_required: !!r?.signature_required,
      photos_required: !!r?.photos_required,
      checklist_required: !!r?.checklist_required,
      two_person_required: !!r?.two_person_required,
      liftgate_needed: !!r?.liftgate_needed,
      dock_appointment: !!r?.dock_appointment,
      id_check: !!r?.id_check,
      temperature_control: !!r?.temperature_control,
      // Text-ish
      access_code: r?.access_code ?? '',
      access_info: r?.access_info ?? '',
      notes: r?.notes ?? '',
    };
  }, [incoming]);

  const initialPay = useMemo(() => {
    const pArr = incoming?.payments || incoming?.payment;
    const p =
      (Array.isArray(pArr) && pArr[0]) ||
      (pArr && !Array.isArray(pArr) ? pArr : null) ||
      null;
    return {
      id: p?.id ?? null,
      stop_id: incoming?.id,
      business_id: incoming?.business_id,
      expected: !!p?.expected,
      amount: p?.amount ?? 0,
      method:
        (p?.method as 'cash' | 'card' | 'check' | 'zelle' | 'other') || 'cash',
      reference: p?.reference ?? '',
      notes: p?.notes ?? '',
    };
  }, [incoming]);

  /** ── Local state per section ───────────────────────────────── */
  // General info
  const [genEdit, setGenEdit] = useState(false);
  const [contactName, setContactName] = useState(incoming?.contact_name ?? '');
  const [contactPhone, setContactPhone] = useState(
    incoming?.contact_phone ?? '',
  );
  const [contactEmail, setContactEmail] = useState(
    incoming?.contact_email ?? '',
  );
  const [businessName, setBusinessName] = useState(
    incoming?.business_name ?? '',
  );
  const [addr1, setAddr1] = useState(incoming?.address_line1 ?? '');
  const [addr2, setAddr2] = useState(incoming?.address_line2 ?? '');
  const [city, setCity] = useState(incoming?.city ?? '');
  const [region, setRegion] = useState(incoming?.region ?? '');
  const [postal, setPostal] = useState(incoming?.postal_code ?? '');
  const [country, setCountry] = useState(incoming?.country_code ?? 'US');

  // Time window / service
  const [winEdit, setWinEdit] = useState(false);
  const [serviceMin, setServiceMin] = useState(
    String(incoming?.service_minutes_planned ?? 10),
  );
  const [winStart, setWinStart] = useState<string>(
    incoming?.time_window_start ?? '',
  ); // 'HH:mm'
  const [winEnd, setWinEnd] = useState<string>(incoming?.time_window_end ?? '');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Requirements
  const [reqEdit, setReqEdit] = useState(false);
  const [req, setReq] = useState(initialReq);

  // Payment
  const [payEdit, setPayEdit] = useState(false);
  const [pay, setPay] = useState(initialPay);

  // Saving flags
  const [savingGen, setSavingGen] = useState(false);
  const [savingWin, setSavingWin] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [savingPay, setSavingPay] = useState(false);

  /** ── Save handlers (section-scoped) ───────────────────────── */

  const saveGeneral = async () => {
    try {
      setSavingGen(true);
      const partial = {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        business_name: businessName.trim(),
        address_line1: addr1.trim(),
        address_line2: addr2.trim() || null,
        city: city.trim(),
        region: region.trim(),
        postal_code: postal.trim() || null,
        country_code: (country || 'US').toUpperCase(),
      };
      const res = await updateStop(incoming.id, partial);
      if (!res?.success) throw new Error(res?.message || 'Update failed');
      setGenEdit(false);
      Alert.alert('Saved', 'General info updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update general info.');
    } finally {
      setSavingGen(false);
    }
  };

  const saveWindow = async () => {
    try {
      setSavingWin(true);
      const partial = {
        service_minutes_planned: Number(serviceMin) || 10,
        time_window_start: winStart || null,
        time_window_end: winEnd || null,
      };
      const res = await updateStop(incoming.id, partial);
      if (!res?.success) throw new Error(res?.message || 'Update failed');
      setWinEdit(false);
      Alert.alert('Saved', 'Time window & service updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update time window.');
    } finally {
      setSavingWin(false);
    }
  };

  const saveRequirements = async () => {
    try {
      setSavingReq(true);
      const payload = {
        ...req,
        stop_id: incoming.id,
        business_id: business?.id,
      };
      const res = await createStopsRequirements(payload); // behaves as UPSERT
      if (!res?.success) throw new Error(res?.message || 'Update failed');
      setReqEdit(false);
      Alert.alert('Saved', 'Requirements updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update requirements.');
    } finally {
      setSavingReq(false);
    }
  };

  const savePayment = async () => {
    try {
      setSavingPay(true);
      const payload = {
        ...pay,
        stop_id: incoming.id,
        business_id: business?.id,
        expected: !!pay.expected,
        amount: Number(pay.amount) || 0,
        reference: pay.reference?.trim() || null,
        notes: pay.notes?.trim() || null,
      };
      const res = await createStopsPayments(payload); // behaves as UPSERT
      if (!res?.success) throw new Error(res?.message || 'Update failed');
      setPayEdit(false);
      Alert.alert('Saved', 'Payment updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update payment.');
    } finally {
      setSavingPay(false);
    }
  };

  /** ── Render helpers ───────────────────────────────────────── */

  const Row = ({ label, value }: { label: string; value?: any }) => (
    <View style={tw`flex-row justify-between mb-1`}>
      <Text style={[tw`text-xs`, { color: colors.muted }]}>{label}</Text>
      <Text style={[tw`text-xs font-medium`, { color: colors.text }]}>
        {value ?? '—'}
      </Text>
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-2 pt-4 pb-3 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <View style={tw`pl-2`}>
          <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
            Stop Summary
          </Text>
          <Text style={[tw`text-2xs mt-0.5`, { color: colors.muted }]}>
            Edit sections inline; saves apply immediately.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-28`}>
        {/* General Info */}
        <View
          style={[tw`rounded-2xl p-3 mb-3`, { backgroundColor: colors.border }]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <View style={tw`flex-row items-center`}>
              <MapPin width={16} height={16} color={colors.text} />
              <Text
                style={[
                  tw`ml-2 text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                General Info
              </Text>
            </View>
            {!genEdit ? (
              <TouchableOpacity onPress={() => setGenEdit(true)}>
                <Edit3 width={18} height={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  disabled={savingGen}
                  onPress={saveGeneral}
                  style={[
                    tw`px-3 py-1 rounded-lg mr-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {savingGen ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setGenEdit(false)}>
                  <CloseIcon width={18} height={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!genEdit ? (
            <>
              <Row label="Type" value={incoming?.stop_type} />
              <Row label="Business" value={incoming?.business_name} />
              <Row label="Contact" value={incoming?.contact_name} />
              <Row label="Phone" value={incoming?.contact_phone} />
              <Row label="Email" value={incoming?.contact_email} />
              <Row
                label="Address"
                value={
                  [incoming?.address_line1, incoming?.city, incoming?.region]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              <Row label="Postal" value={incoming?.postal_code} />
              <Row label="Country" value={incoming?.country_code} />
              <Row label="Sequence" value={incoming?.sequence} />
            </>
          ) : (
            <>
              <Field
                label="Business / Customer Name"
                value={businessName}
                onChangeText={setBusinessName}
                colors={colors}
              />
              <Field
                label="Contact Name"
                value={contactName}
                onChangeText={setContactName}
                colors={colors}
              />
              <View style={tw`flex-row`}>
                <View style={tw`flex-1 mr-2`}>
                  <Field
                    label="Phone"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    colors={colors}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={tw`flex-1`}>
                  <Field
                    label="Email"
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    colors={colors}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Field
                label="Address Line 1"
                value={addr1}
                onChangeText={setAddr1}
                colors={colors}
              />
              <Field
                label="Address Line 2"
                value={addr2}
                onChangeText={setAddr2}
                colors={colors}
              />
              <View style={tw`flex-row`}>
                <View style={tw`flex-1 mr-2`}>
                  <Field
                    label="City"
                    value={city}
                    onChangeText={setCity}
                    colors={colors}
                  />
                </View>
                <View style={tw`flex-1`}>
                  <Field
                    label="Region"
                    value={region}
                    onChangeText={setRegion}
                    colors={colors}
                  />
                </View>
              </View>
              <View style={tw`flex-row`}>
                <View style={tw`flex-1 mr-2`}>
                  <Field
                    label="Postal"
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
            </>
          )}
        </View>

        {/* Time Window & Service */}
        <View
          style={[tw`rounded-2xl p-3 mb-3`, { backgroundColor: colors.border }]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <View style={tw`flex-row items-center`}>
              <Clock width={16} height={16} color={colors.text} />
              <Text
                style={[
                  tw`ml-2 text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Time Window & Service
              </Text>
            </View>
            {!winEdit ? (
              <TouchableOpacity onPress={() => setWinEdit(true)}>
                <Edit3 width={18} height={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  disabled={savingWin}
                  onPress={saveWindow}
                  style={[
                    tw`px-3 py-1 rounded-lg mr-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {savingWin ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWinEdit(false)}>
                  <CloseIcon width={18} height={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!winEdit ? (
            <>
              <Row
                label="Window Start"
                value={incoming?.time_window_start || '—'}
              />
              <Row
                label="Window End"
                value={incoming?.time_window_end || '—'}
              />
              <Row
                label="Service Minutes"
                value={incoming?.service_minutes_planned ?? 10}
              />
            </>
          ) : (
            <>
              <Text style={tw`text-gray-400 text-xs mb-1`}>Window Start</Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={[
                  tw`px-3 py-2 rounded-xl mb-2`,
                  { backgroundColor: colors.main },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Clock width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {winStart || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={tw`text-gray-400 text-xs mb-1`}>Window End</Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={[
                  tw`px-3 py-2 rounded-xl mb-2`,
                  { backgroundColor: colors.main },
                ]}
              >
                <View style={tw`flex-row items-center`}>
                  <Calendar width={16} height={16} color="#9CA3AF" />
                  <Text style={[tw`ml-2`, { color: colors.text }]}>
                    {winEnd || 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={tw`text-gray-400 text-xs mb-1`}>
                Service Minutes
              </Text>
              <View
                style={[
                  tw`px-3 py-2 rounded-xl`,
                  { backgroundColor: colors.main },
                ]}
              >
                <TextInput
                  value={serviceMin}
                  onChangeText={setServiceMin}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={'#9CA3AF'}
                  style={[{ color: colors.text, padding: 0 }]}
                />
              </View>
            </>
          )}
        </View>

        {/* Requirements */}
        <View
          style={[tw`rounded-2xl p-3 mb-3`, { backgroundColor: colors.border }]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <View style={tw`flex-row items-center`}>
              <CheckSquare width={16} height={16} color={colors.text} />
              <Text
                style={[
                  tw`ml-2 text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Requirements
              </Text>
            </View>
            {!reqEdit ? (
              <TouchableOpacity onPress={() => setReqEdit(true)}>
                <Edit3 width={18} height={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  disabled={savingReq}
                  onPress={saveRequirements}
                  style={[
                    tw`px-3 py-1 rounded-lg mr-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {savingReq ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReq(initialReq);
                    setReqEdit(false);
                  }}
                >
                  <CloseIcon width={18} height={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!reqEdit ? (
            <>
              <Row
                label="Give Invoice"
                value={req.give_invoice ? 'Yes' : 'No'}
              />
              <Row label="Print Name" value={req.print_name ? 'Yes' : 'No'} />
              <Row label="Contactless" value={req.contactless ? 'Yes' : 'No'} />
              <Row
                label="Contact Before"
                value={req.contact_before ? 'Yes' : 'No'}
              />
              <Row
                label="Signature Required"
                value={req.signature_required ? 'Yes' : 'No'}
              />
              <Row
                label="Photos Required"
                value={req.photos_required ? 'Yes' : 'No'}
              />
              <Row
                label="Checklist Required"
                value={req.checklist_required ? 'Yes' : 'No'}
              />
              <Row
                label="Two-person Assist"
                value={req.two_person_required ? 'Yes' : 'No'}
              />
              <Row
                label="Liftgate Needed"
                value={req.liftgate_needed ? 'Yes' : 'No'}
              />
              <Row
                label="Dock Appointment"
                value={req.dock_appointment ? 'Yes' : 'No'}
              />
              <Row label="ID Check" value={req.id_check ? 'Yes' : 'No'} />
              <Row
                label="Temperature Control"
                value={req.temperature_control ? 'Yes' : 'No'}
              />
              <Row label="Access Code" value={req.access_code || '—'} />
              <Row label="Access Info" value={req.access_info || '—'} />
              <Row label="Notes" value={req.notes || '—'} />
            </>
          ) : (
            <>
              {/* toggles */}
              {(
                [
                  ['Give Invoice', 'give_invoice'],
                  ['Print Name', 'print_name'],
                  ['Contactless', 'contactless'],
                  ['Contact Before', 'contact_before'],
                  ['Signature Required', 'signature_required'],
                  ['Photos Required', 'photos_required'],
                  ['Checklist Required', 'checklist_required'],
                  ['Two-person Assist', 'two_person_required'],
                  ['Liftgate Needed', 'liftgate_needed'],
                  ['Dock Appointment', 'dock_appointment'],
                  ['ID Check', 'id_check'],
                  ['Temperature Control', 'temperature_control'],
                ] as const
              ).map(([label, key]) => (
                <View
                  key={key}
                  style={[
                    tw`px-3 py-2 rounded-xl mb-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between`}>
                    <Text style={[{ color: colors.text }]}>{label}</Text>
                    <Switch
                      value={(req as any)[key]}
                      onValueChange={v =>
                        setReq(prev => ({ ...prev, [key]: v }))
                      }
                      thumbColor={(req as any)[key] ? colors.primary : '#666'}
                    />
                  </View>
                </View>
              ))}

              {/* text fields */}
              <Field
                label="Access Code"
                value={req.access_code}
                onChangeText={(t: string) =>
                  setReq(p => ({ ...p, access_code: t }))
                }
                colors={colors}
              />
              <Field
                label="Access Info"
                value={req.access_info}
                onChangeText={(t: string) =>
                  setReq(p => ({ ...p, access_info: t }))
                }
                colors={colors}
              />
              <Field
                label="Notes"
                value={req.notes}
                onChangeText={(t: string) => setReq(p => ({ ...p, notes: t }))}
                colors={colors}
              />
            </>
          )}
        </View>

        {/* Payment */}
        <View
          style={[tw`rounded-2xl p-3 mb-3`, { backgroundColor: colors.border }]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <View style={tw`flex-row items-center`}>
              <DollarSign width={16} height={16} color={colors.text} />
              <Text
                style={[
                  tw`ml-2 text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Payment
              </Text>
            </View>
            {!payEdit ? (
              <TouchableOpacity onPress={() => setPayEdit(true)}>
                <Edit3 width={18} height={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={tw`flex-row`}>
                <TouchableOpacity
                  disabled={savingPay}
                  onPress={savePayment}
                  style={[
                    tw`px-3 py-1 rounded-lg mr-2`,
                    { backgroundColor: colors.main },
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {savingPay ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPay(initialPay);
                    setPayEdit(false);
                  }}
                >
                  <CloseIcon width={18} height={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!payEdit ? (
            <>
              <Row label="Expected" value={pay.expected ? 'Yes' : 'No'} />
              <Row
                label="Amount"
                value={pay.amount ? `$${Number(pay.amount).toFixed(2)}` : '—'}
              />
              <Row label="Method" value={pay.method?.toUpperCase() || '—'} />
              <Row label="Reference" value={pay.reference || '—'} />
              <Row label="Notes" value={pay.notes || '—'} />
            </>
          ) : (
            <>
              <View
                style={[
                  tw`px-3 py-2 rounded-xl mb-2`,
                  { backgroundColor: colors.main },
                ]}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={{ color: colors.text }}>Payment Expected</Text>
                  <Switch
                    value={!!pay.expected}
                    onValueChange={v =>
                      setPay(prev => ({ ...prev, expected: v }))
                    }
                    thumbColor={pay.expected ? colors.primary : '#666'}
                  />
                </View>
              </View>

              {pay.expected && (
                <>
                  <Text style={tw`text-gray-400 text-xs mb-1`}>Amount</Text>
                  <View
                    style={[
                      tw`px-3 py-2 rounded-xl mb-2 flex-row items-center`,
                      { backgroundColor: colors.main },
                    ]}
                  >
                    <DollarSign width={16} height={16} color="#9CA3AF" />
                    <TextInput
                      value={String(pay.amount ?? '')}
                      onChangeText={t =>
                        setPay(prev => ({ ...prev, amount: t }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={'#9CA3AF'}
                      style={[
                        tw`ml-2 flex-1`,
                        { color: colors.text, padding: 0 },
                      ]}
                    />
                  </View>

                  <Text style={tw`text-gray-400 text-xs mb-1`}>Method</Text>
                  <View
                    style={[
                      tw`flex-row p-1 rounded-xl mb-2`,
                      { backgroundColor: colors.main },
                    ]}
                  >
                    {(['cash', 'card', 'check', 'zelle', 'other'] as const).map(
                      k => {
                        const active = pay.method === k;
                        return (
                          <TouchableOpacity
                            key={k}
                            onPress={() =>
                              setPay(prev => ({ ...prev, method: k }))
                            }
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
                      },
                    )}
                  </View>

                  <Field
                    label="Reference (Invoice/PO)"
                    value={pay.reference ?? ''}
                    onChangeText={t =>
                      setPay(prev => ({ ...prev, reference: t }))
                    }
                    colors={colors}
                  />
                  <Field
                    label="Payment Notes"
                    value={pay.notes ?? ''}
                    onChangeText={t => setPay(prev => ({ ...prev, notes: t }))}
                    colors={colors}
                  />
                </>
              )}
            </>
          )}
        </View>

        {/* Bottom action */}
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={[
            tw`mt-2 px-4 py-3 rounded-2xl items-center`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>Apply Changes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Time pickers */}
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
              value={new Date(`1970-01-01T${winStart || '08:00'}:00`)}
              onChange={(_, d) => {
                if (d) setWinStart(toHHmm(d));
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
              value={new Date(`1970-01-01T${winEnd || '09:00'}:00`)}
              onChange={(_, d) => {
                if (d) setWinEnd(toHHmm(d));
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
    </View>
  );
}
