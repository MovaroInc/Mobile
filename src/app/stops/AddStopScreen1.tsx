// src/app/routes/AddStopScreen1.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  Switch, // >>> for Lunch auto toggle
} from 'react-native';
import tw from 'twrnc';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  StackActions,
  CommonActions,
} from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import {
  ChevronLeft,
  Users as UsersIcon,
  Briefcase as VendorIcon,
  UserPlus as OneTimeIcon,
  MapPin,
  Search as SearchIcon,
  X as CloseIcon,
  Check as CheckIcon,
} from 'react-native-feather';

import Field from '../../shared/components/inputs/Field';
import FieldSuggestions from '../../shared/components/inputs/FieldSuggestions';
import SelectInput from '../../shared/components/inputs/SelectInput';
import { grabCustomers, grabVendors } from '../../shared/lib/CustomerVendorApi';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStop } from '../../shared/lib/StopsHelpers';

type RouteParams = {
  routeId: number;
  stopsCount: number;
};

type Entity = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  // optional address fields if returned by your API (used for display)
  address_line1?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

type StopDraft = {
  routeId: number;
  stopType: string;
  selectedUse: 'customer' | 'vendor' | 'one_time';
  customerId: number | null;
  vendorId: number | null;
  otName: string;
  otPhone: string | null;
  otEmail: string | null;
  otCustomerName: string | null;
  address: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postal: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export default function AddStopScreen1() {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { colors } = useTheme();
  const { business } = useSession();
  const { routeId, stopsCount } = params as RouteParams;

  // Stop type
  const [stopType, setStopType] = useState<string>('Delivery');

  // “Who” options (hidden for Base/Lunch)
  const [stopUse, setStopUse] = useState<
    { key: string; label: string; Icon: any }[]
  >([
    { key: 'customer', label: 'Customer', Icon: UsersIcon },
    { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
  ]);
  const [selectedUse, setSelectedUse] = useState<string>('customer');

  // Entities
  const [customers, setCustomers] = useState<Entity[]>([]);
  const [vendors, setVendors] = useState<Entity[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Selected entity / one-time contact info
  const [selectedCustomer, setSelectedCustomer] = useState<Entity | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Entity | null>(null);

  const [otName, setOtName] = useState('');
  const [otPhone, setOtPhone] = useState('');
  const [otEmail, setOtEmail] = useState('');
  const [otCustomerName, setOtCustomerName] = useState('');

  // For pre-filling contact when chosen from customer/vendor
  const [selectedName, setSelectedName] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // Address (used for regular stops only)
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [address, setAddress] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('US');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Modals
  const [pickerOpen, setPickerOpen] = useState(false);

  // >>> NEW: Base/Lunch flags and UI state
  const isBase = stopType === 'Base / HQ';
  const isLunch = stopType === 'Lunch';
  const [creatingBase, setCreatingBase] = useState(false);

  // Lunch options
  const LUNCH_OPTIONS = [30, 45, 60, 90, 120];
  const [lunchMinutes, setLunchMinutes] = useState<number>(30);
  const [lunchAuto, setLunchAuto] = useState<boolean>(false);

  const [creatingLunch, setCreatingLunch] = useState(false);

  // Stop type → “Who” options (hidden for Base/Lunch)
  useEffect(() => {
    if (isBase || isLunch) {
      setStopUse([]); // hide “Who”
      return;
    }
    if (stopType === 'Delivery') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    } else if (stopType === 'Pickup') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    } else if (stopType === 'Service' || stopType === 'Install') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    } else if (stopType === 'Repair') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
      ]);
    } else if (stopType === 'Other') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
  }, [stopType, isBase, isLunch]);

  // Load lists and init
  useFocusEffect(
    useCallback(() => {
      if (!business?.id) return;
      handleCustomers(business.id);
      handleVendors(business.id);
      // keep any existing draft init you had…
    }, [business]),
  );

  const handleCustomers = async (businessId: number) => {
    try {
      const resp = await grabCustomers(businessId);
      setCustomers(resp.data);
    } catch {
      setCustomers([]);
    }
  };

  const handleVendors = async (businessId: number) => {
    try {
      const resp = await grabVendors(businessId);
      setVendors(resp);
    } catch {
      setVendors([]);
    }
  };

  const handleSelected = (ent: any) => {
    if (selectedUse === 'customer') {
      setSelectedCustomer(ent);
    } else if (selectedUse === 'vendor') {
      setSelectedVendor(ent);
    }
    // hydrate address/contact if present
    const a1 = ent.address_line1 ?? '';
    const c1 = ent.city ?? '';
    const r1 = ent.region ?? '';
    const p1 = ent.postal_code ?? '';
    const cc = ent.country_code ?? 'US';
    setAddress([a1, c1, r1].filter(Boolean).join(', '));
    setLine1(a1);
    setCity(c1);
    setRegion(r1);
    setPostal(p1);
    setCountry(cc);
    setLatitude(ent.latitude ?? null);
    setLongitude(ent.longitude ?? null);
    setSelectedName(ent.contact_name ?? '');
    setSelectedPhone(ent.contact_phone ?? '');
    setSelectedEmail(ent.contact_email ?? '');
    setSelectedCustomerName(ent.name ?? '');
  };

  // Address helpers (kept from your version)
  const handleSearchAddress = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    const options = {
      method: 'GET',
      url: 'https://google-place-autocomplete-and-place-info.p.rapidapi.com/maps/api/place/autocomplete/json',
      params: { input: text },
      headers: {
        'x-rapidapi-key': 'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
        'x-rapidapi-host':
          'google-place-autocomplete-and-place-info.p.rapidapi.com',
      },
    };
    try {
      const response = await axios.request(options);
      const predictions = response.data?.predictions || [];
      setSuggestions(predictions);
    } catch {
      Alert.alert('Error searching addresses.');
    }
  };

  const getPlaceCoordinates = async (text: string) => {
    if (!text) return;
    const options = {
      method: 'GET',
      url: 'https://google-maps-geocoding3.p.rapidapi.com/geocode',
      params: { address: text },
      headers: {
        'x-rapidapi-key': 'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
        'x-rapidapi-host': 'google-maps-geocoding3.p.rapidapi.com',
      },
    };
    try {
      const resp = await axios.request(options);
      if (resp?.data?.latitude && resp?.data?.longitude) {
        setLatitude(parseFloat(resp.data.latitude));
        setLongitude(parseFloat(resp.data.longitude));
      }
    } catch {}
  };

  useEffect(() => {
    if (!isBase && !isLunch && address.length > 2) {
      const full = address.split(', ');
      setLine1(full[0] ?? '');
      setCity(full[1] ?? '');
      setRegion(full[2] ?? '');
      setCountry('US');
      getPlaceCoordinates(address);
    }
  }, [address, isBase, isLunch]);

  // >>> VALIDATION
  const canContinue = useMemo(() => {
    if (isBase) return false; // we show "Confirm Base" instead of Next
    if (isLunch) return true; // lunch doesn’t need Who/Address here
    const hasAddress = line1.trim() && city.trim() && region.trim();
    if (!hasAddress) return false;
    if (!stopType) return false;
    if (!selectedUse) return false;
    if (selectedUse === 'customer') return !!selectedCustomer;
    if (selectedUse === 'vendor') return !!selectedVendor;
    if (selectedUse === 'one_time') return !!otName.trim();
    return false;
  }, [
    isBase,
    isLunch,
    stopType,
    selectedUse,
    selectedCustomer,
    selectedVendor,
    otName,
    line1,
    city,
    region,
  ]);

  // >>> Confirm Base: create immediately and go back to RouteDraft
  const onConfirmBase = async () => {
    try {
      if (!business?.id) {
        Alert.alert('Missing business', 'Cannot determine base info.');
        return;
      }
      setCreatingBase(true);

      // Use your business/HQ info when available. Fallbacks are safe no-ops.
      const payload = {
        route_id: routeId,
        business_id: business.id,
        stop_type: 'baae', // backend can treat as Base/HQ type
        depot_role: 'start', // optional: mark as return-to-base
        customer_id: null,
        vendor_id: null,
        address_line1: business.address_line1 ?? '',
        address_line2: business.address_line2 ?? null,
        city: business.city ?? '',
        region: business.region ?? '',
        postal_code: business.postal_code ?? null,
        country_code: business.country_code ?? 'US',
        latitude: business.latitude ?? null,
        longitude: business.longitude ?? null,
        status: 'scheduled',
        contact_name: business.name ?? 'Base',
        contact_phone: business.phone ?? '',
        contact_email: business.email ?? '',
        business_name: 'Base',
        sequence: stopsCount + 1, // append
      };

      const res = await createStop(payload);
      if (!res?.success) {
        Alert.alert('Error', res?.message ?? 'Failed to create base stop');
        return;
      }

      // Pop back to the existing RouteDraftScreen (no duplicate pushes)
      nav.dispatch(state => {
        const idx = state.routes.findIndex(r => r.name === 'RouteDraftScreen');
        if (idx === -1) return CommonActions.navigate('RouteDraftScreen');
        const popCount = state.index - idx;
        return StackActions.pop(popCount);
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create base stop.');
    } finally {
      setCreatingBase(false);
    }
  };

  const conConfirmLunch = async () => {
    try {
      if (!business?.id) {
        Alert.alert('Missing business', 'Cannot determine base info.');
        return;
      }
      setCreatingLunch(true);

      // Use your business/HQ info when available. Fallbacks are safe no-ops.
      const payload = {
        route_id: routeId,
        business_id: business.id,
        stop_type: 'lunch', // backend can treat as Base/HQ type
        depot_role: null, // optional: mark as return-to-base
        customer_id: null,
        vendor_id: null,
        address_line1: business.address_line1 ?? '',
        address_line2: business.address_line2 ?? null,
        city: business.city ?? '',
        region: business.region ?? '',
        postal_code: business.postal_code ?? null,
        country_code: business.country_code ?? 'US',
        latitude: business.latitude ?? null,
        longitude: business.longitude ?? null,
        status: 'scheduled',
        contact_name: 'Base',
        contact_phone: '',
        contact_email: '',
        business_name: 'Lunch',
        sequence: stopsCount + 1, // append
        is_lunch: true,
        expected_duration: lunchMinutes,
        auto_trigger: lunchAuto,
      };

      const res = await createStop(payload);
      if (!res?.success) {
        Alert.alert('Error', res?.message ?? 'Failed to create base stop');
        return;
      }

      // Pop back to the existing RouteDraftScreen (no duplicate pushes)
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create base stop.');
    } finally {
      setCreatingLunch(false);
    }
  };

  // Next for all other types (Lunch continues, regular flow unchanged)
  const onNext = async () => {
    if (!canContinue && !isLunch) return;

    // For Lunch, stash defaults for step 2 (you can read these in Screen 2)
    if (isLunch) {
      await AsyncStorage.setItem(
        'lunch_defaults',
        JSON.stringify({ minutes: lunchMinutes, auto: lunchAuto }),
      );
    }

    // Build regular Step 1 payload for non-Base types
    const currentPayload = {
      route_id: routeId,
      business_id: business?.id,
      stop_type: stopType.toLowerCase(), // 'lunch' when Lunch
      depot_role: null,
      customer_id: selectedCustomer?.id || null,
      vendor_id: selectedVendor?.id || null,
      address_line1: isLunch ? '' : line1.trim(),
      address_line2: isLunch ? null : line2.trim() || null,
      city: isLunch ? '' : city.trim(),
      region: isLunch ? '' : region.trim(),
      postal_code: isLunch ? null : postal.trim() || null,
      country_code: isLunch ? 'US' : (country || 'US').toUpperCase(),
      latitude: isLunch ? null : latitude,
      longitude: isLunch ? null : longitude,
      status: 'scheduled',
      contact_name: selectedUse === 'one_time' ? otName.trim() : selectedName,
      contact_phone:
        selectedUse === 'one_time' ? otPhone.trim() : selectedPhone,
      contact_email:
        selectedUse === 'one_time' ? otEmail.trim() : selectedEmail,
      business_name:
        selectedUse === 'one_time'
          ? otCustomerName.trim()
          : selectedCustomerName,
      sequence: 0,
      // stash lunch config for later if needed
      _lunch: isLunch ? { minutes: lunchMinutes, auto: lunchAuto } : undefined,
    };

    await AsyncStorage.setItem('step1Payload', JSON.stringify(currentPayload));

    nav.navigate('AddStopScreen2', {
      routeId,
      stopsCount,
    });
  };

  const handleSelectedUse = (use: string) => {
    setSelectedUse(use);
    setQuery('');
    setLine1('');
    setCity('');
    setRegion('');
    setPostal('');
    setCountry('US');
    setLatitude(null);
    setLongitude(null);
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
        </View>
      </View>
      <View style={tw`px-4 pb-4`}>
        <Text style={[tw`text-xs`, { color: colors.muted }]}>
          {isBase
            ? 'Quick add — Return to Base'
            : isLunch
            ? 'Step 1 of 3 — Lunch Options'
            : 'Step 1 of 3 — Who & Where'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4 pb-28`}
      >
        {/* Stop type */}
        <Text style={[tw`text-lg font-semibold mb-3`, { color: colors.text }]}>
          Stop Type
        </Text>
        <View style={tw`flex-row justify-between flex-wrap w-full mb-4`}>
          {[
            'Delivery',
            'Pickup',
            'Service',
            'Base / HQ',
            'Install',
            'Repair',
            'Lunch',
            'Other',
          ].map(t => (
            <TouchableOpacity
              key={t}
              style={[
                tw`w-[49%] px-3 py-2 rounded-lg flex-row items-center justify-center mb-2`,
                {
                  backgroundColor:
                    stopType === t ? colors.brand?.primary : colors.border,
                },
              ]}
              onPress={() => setStopType(t)}
            >
              <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* >>> Base / HQ content */}
        {isBase && (
          <View
            style={[
              tw`rounded-2xl p-3 mb-2`,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
              Confirm Return to Base
            </Text>
            <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
              This stop will send the driver back to your company HQ. Customer
              selection isn’t required—address and contact details will use your
              business information.
            </Text>

            <TouchableOpacity
              onPress={onConfirmBase}
              disabled={creatingBase}
              style={[
                tw`mt-3 px-4 py-3 rounded-2xl items-center`,
                {
                  backgroundColor: creatingBase
                    ? colors.border
                    : colors.brand?.primary || '#2563eb',
                },
              ]}
            >
              <Text style={tw`text-white font-semibold`}>
                {creatingBase ? 'Creating…' : 'Confirm Base'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* >>> Lunch content */}
        {isLunch && (
          <View>
            <Text
              style={[tw`text-lg font-semibold mb-2`, { color: colors.text }]}
            >
              Lunch Duration
            </Text>

            <View
              style={[
                tw`flex-row p-1 rounded-xl mb-2`,
                { backgroundColor: colors.border },
              ]}
            >
              {LUNCH_OPTIONS.map(min => {
                const active = lunchMinutes === min;
                return (
                  <TouchableOpacity
                    key={min}
                    onPress={() => setLunchMinutes(min)}
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
                      {min} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                tw`px-3 py-2 rounded-xl mb-2`,
                { backgroundColor: colors.border },
              ]}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <Text style={{ color: colors.text }}>Auto-Trigger Lunch</Text>
                <Switch value={lunchAuto} onValueChange={setLunchAuto} />
              </View>
              <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
                If on, lunch starts automatically at the planned time. If off,
                the driver starts lunch manually.
              </Text>
            </View>
          </View>
        )}

        {/* >>> Regular “Who & Address” (hidden for Base/Lunch) */}
        {!isBase && !isLunch && (
          <>
            <Text
              style={[tw`text-lg font-semibold mb-3`, { color: colors.text }]}
            >
              Who
            </Text>

            <SegmentedControl
              value={selectedUse}
              onChange={use => {
                setSelectedUse(use);
                setQuery('');
                setLine1('');
                setCity('');
                setRegion('');
                setPostal('');
                setCountry('US');
                setLatitude(null);
                setLongitude(null);
              }}
              colors={colors}
              options={stopUse}
            />

            <View style={tw`mt-3`}>
              {selectedUse === 'customer' && (
                <SelectInput
                  label="Customer"
                  selectedValue={selectedCustomer?.name || 'Select'}
                  onPress={() => setPickerOpen(true)}
                  colors={colors}
                  required
                />
              )}
              {selectedUse === 'vendor' && (
                <SelectInput
                  label="Vendor"
                  selectedValue={selectedVendor?.name || 'Select'}
                  onPress={() => setPickerOpen(true)}
                  colors={colors}
                  required
                />
              )}
              {selectedUse === 'one_time' && (
                <>
                  <Field
                    label="Customer Name "
                    value={otCustomerName}
                    onChangeText={setOtCustomerName}
                    colors={colors}
                  />
                  <Field
                    label="Contact Name "
                    value={otName}
                    onChangeText={setOtName}
                    colors={colors}
                    required
                  />
                  <View style={tw`flex-row`}>
                    <View style={tw`flex-1 mr-2`}>
                      <Field
                        label="Phone "
                        value={otPhone}
                        onChangeText={setOtPhone}
                        colors={colors}
                        keyboardType="phone-pad"
                        required
                      />
                    </View>
                    <View style={tw`flex-1`}>
                      <Field
                        label="Email"
                        value={otEmail}
                        onChangeText={setOtEmail}
                        colors={colors}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

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
                  <Field
                    label="Office / Suite #"
                    value={line2}
                    onChangeText={setLine2}
                    colors={colors}
                  />
                </>
              )}
            </View>

            <View style={[tw`mt-1 flex-row items-center`, { opacity: 0.8 }]}>
              <MapPin width={14} height={14} color={colors.muted} />
              <Text style={[tw`ml-2 text-2xs`, { color: colors.muted }]}>
                We’ll geocode this address automatically on save.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer CTA */}
      {!isBase && !isLunch && (
        <View style={tw`px-4 pb-4`}>
          <TouchableOpacity
            disabled={!canContinue && !isLunch}
            onPress={onNext}
            style={[
              tw`mt-6 px-4 py-3 rounded-2xl items-center`,
              {
                backgroundColor:
                  isLunch || canContinue
                    ? colors.brand?.primary || '#2563eb'
                    : colors.border,
              },
            ]}
          >
            <Text style={tw`text-white font-semibold`}>
              {isLunch
                ? 'Next: Schedule & Requirements'
                : 'Next: Schedule & Requirements'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {isLunch && (
        <View style={tw`px-4 pb-4`}>
          <TouchableOpacity
            disabled={creatingLunch}
            onPress={conConfirmLunch}
            style={[
              tw`mt-6 px-4 py-3 rounded-2xl items-center`,
              {
                backgroundColor:
                  isLunch || canContinue
                    ? colors.brand?.primary || '#2563eb'
                    : colors.border,
              },
            ]}
          >
            <Text style={tw`text-white font-semibold`}>Create Lunch Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Entity Picker */}
      <EntityPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        colors={colors}
        title={
          selectedUse === 'customer'
            ? 'Select Customer'
            : selectedUse === 'vendor'
            ? 'Select Vendor'
            : 'Select Contact'
        }
        data={selectedUse === 'customer' ? customers : vendors}
        loading={selectedUse === 'customer' ? loadingCustomers : loadingVendors}
        selectedId={
          (selectedUse === 'customer'
            ? selectedCustomer?.id
            : selectedVendor?.id) ?? null
        }
        onSelect={ent => {
          handleSelected(ent);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/* ───────────────────── UI bits (unchanged except for using Switch above) ───────────────────── */

function SegmentedControl({
  value,
  onChange,
  colors,
  options,
}: {
  value: string;
  onChange: (k: any) => void;
  colors: any;
  options: { key: string; label: string; Icon: any }[];
}) {
  return (
    <View
      style={[tw`flex-row p-1 rounded-xl`, { backgroundColor: colors.border }]}
    >
      {options.map(opt => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              tw`flex-1 px-3 py-2 rounded-lg flex-row items-center justify-center`,
              {
                backgroundColor: active
                  ? colors.brand?.primary || '#2563eb'
                  : 'transparent',
              },
            ]}
          >
            <opt.Icon
              width={14}
              height={14}
              color={active ? '#fff' : colors.text}
            />
            <Text
              style={[
                tw`ml-2 text-sm font-semibold`,
                { color: active ? '#fff' : colors.text },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EntityPickerModal({
  visible,
  onClose,
  colors,
  title,
  data,
  loading,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  title: string;
  data: Entity[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (e: Entity) => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data;
    return data.filter(d =>
      [d.name, d.email, d.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [filter, data]);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 bg-black/40`}>
        <View
          style={[
            tw`mt-auto rounded-t-3xl p-4 pb-8`,
            { backgroundColor: colors.main },
          ]}
        >
          <View style={tw`flex-row items-center mb-3`}>
            <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
              {title}
            </Text>
            <View style={tw`flex-1`} />
            <TouchableOpacity onPress={onClose}>
              <CloseIcon width={22} height={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              tw`flex-row items-center px-3 py-2 rounded-2xl mb-3`,
              { backgroundColor: colors.border },
            ]}
          >
            <SearchIcon width={16} height={16} color="#9CA3AF" />
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search name, email, phone…"
              placeholderTextColor={'#9CA3AF'}
              style={[tw`ml-2 flex-1`, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={tw`py-6 items-center`}>
              <ActivityIndicator />
              <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
                Loading…
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => String(i.id)}
              style={tw`max-h-96`}
              renderItem={({ item }) => {
                const isSel = item.id === selectedId;
                return (
                  <TouchableOpacity
                    onPress={() => onSelect(item)}
                    style={[
                      tw`px-3 py-3 rounded-2xl mb-2`,
                      {
                        backgroundColor: isSel
                          ? colors.brand?.primary || '#2563eb'
                          : colors.border,
                      },
                    ]}
                  >
                    <View style={tw`flex-row items-center justify-between`}>
                      <View style={tw`flex-1`}>
                        <Text
                          style={[
                            tw`text-lg`,
                            { color: isSel ? '#fff' : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {(item.address_line1 || item.city) && (
                          <Text
                            style={[
                              tw`text-xs`,
                              { color: isSel ? '#fff' : colors.muted },
                            ]}
                          >
                            {item.address_line1 || ''}
                            {item.city ? `. ${item.city}` : ''}
                            {item.region ? `, ${item.region}` : ''}{' '}
                            {item.postal_code || ''}
                          </Text>
                        )}
                        {(item.email || item.phone) && (
                          <Text
                            style={[
                              tw`text-xs mt-0.5`,
                              { color: isSel ? '#fff' : colors.muted },
                            ]}
                            numberOfLines={1}
                          >
                            {[item.email, item.phone]
                              .filter(Boolean)
                              .join(' • ')}
                          </Text>
                        )}
                      </View>
                      {isSel && (
                        <CheckIcon width={18} height={18} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[tw`text-center py-4`, { color: colors.muted }]}>
                  No results
                </Text>
              }
            />
          )}

          <TouchableOpacity
            onPress={onClose}
            style={[
              tw`mt-3 px-4 py-3 rounded-2xl items-center`,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
