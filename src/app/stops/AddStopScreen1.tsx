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
} from 'react-native';
import tw from 'twrnc';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
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
import { api } from '../../shared/lib/api';
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
  name: string; // display name
  email?: string | null;
  phone?: string | null;
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

  // Step state
  const [stopType, setStopType] = useState<string>('Delivery');
  const [stopUse, setStopUse] = useState<
    { key: string; label: string; Icon: any }[]
  >([
    { key: 'customer', label: 'Customer', Icon: UsersIcon },
    { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
  ]);
  const [selectedUse, setSelectedUse] = useState<string>('customer');

  // Entities (real data: load from API)
  const [customers, setCustomers] = useState<Entity[]>([]);
  const [vendors, setVendors] = useState<Entity[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Selected entity / one-time contact info
  const [selectedCustomer, setSelectedCustomer] = useState<Entity | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Entity | null>(null);

  const [otName, setOtName] = useState(''); // one-time
  const [otPhone, setOtPhone] = useState('');
  const [otEmail, setOtEmail] = useState('');
  const [otCustomerName, setOtCustomerName] = useState('');

  const [selectedName, setSelectedName] = useState(''); // one-time
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // Address (with autofill)
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

  useEffect(() => {
    if (stopType === 'Delivery') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
    if (stopType === 'Pickup') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
    if (stopType === 'Service') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
    if (stopType === 'Install') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
    if (stopType === 'Repair') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
      ]);
    }
    if (stopType === 'Other') {
      setStopUse([
        { key: 'customer', label: 'Customer', Icon: UsersIcon },
        { key: 'vendor', label: 'Vendor', Icon: VendorIcon },
        { key: 'one_time', label: 'One-time', Icon: OneTimeIcon },
      ]);
    }
  }, [stopType]);
  // Load entitie

  useFocusEffect(
    useCallback(() => {
      if (!business?.id) return;
      initiateForm();
      handleCustomers(business.id);
      handleVendors(business.id);
      initializeStop();
    }, [business]),
  );

  useEffect(() => {
    const getSelectedCustomer = async () => {
      if (customers.length > 0) {
        const p1 = await AsyncStorage.getItem('step1Payload');
        const payload1 = JSON.parse(p1 || '{}');
        const customer = customers.find(c => c.id === payload1.customer_id);
        if (customer) {
          setSelectedCustomer(customer);
          setAddress(
            `${customer.address_line1}, ${customer.city}, ${customer.region} ${customer.postal_code}`,
          );
          setLine1(customer.address_line1);
          setCity(customer.city);
          setRegion(customer.region);
          setPostal(customer.postal_code);
          setCountry(customer.country_code);
          setLatitude(customer.latitude);
          setLongitude(customer.longitude);
          setSelectedName(customer.contact_name);
          setSelectedPhone(customer.contact_phone);
          setSelectedEmail(customer.contact_email);
          setSelectedCustomerName(customer.name);
        }
      }
      if (vendors.length > 0) {
        const p1 = await AsyncStorage.getItem('step1Payload');
        const payload1 = JSON.parse(p1 || '{}');
        const vendor = vendors.find(v => v.id === payload1.vendor_id);
        if (vendor) {
          setSelectedVendor(vendor);
          setAddress(
            `${vendor.address_line1}, ${vendor.city}, ${vendor.region} ${vendor.postal_code}`,
          );
          setLine1(vendor.address_line1);
          setCity(vendor.city);
          setRegion(vendor.region);
          setPostal(vendor.postal_code);
          setCountry(vendor.country_code);
          setLatitude(vendor.latitude);
          setLongitude(vendor.longitude);
          setSelectedName(vendor.contact_name);
          setSelectedPhone(vendor.contact_phone);
          setSelectedEmail(vendor.contact_email);
          setSelectedCustomerName(vendor.name);
        }
      }
    };
    getSelectedCustomer();
  }, [customers, vendors]);

  const initializeStop = async () => {
    const p1 = await AsyncStorage.getItem('step1Payload');
    const payload1 = JSON.parse(p1 || '{}');
    console.log('p1', payload1);
    if (payload1.stopType) {
      setStopType(payload1.stopType);
    }
    if (payload1.selectedUse) {
      setSelectedUse(payload1.selectedUse);
    }
  };

  const draftIdsRef = React.useRef<{
    customerId: number | null;
    vendorId: number | null;
  }>({
    customerId: null,
    vendorId: null,
  });

  const initiateForm = async () => {
    try {
      const str = await AsyncStorage.getItem('stop_draft');
      if (!str) return;

      const d: Partial<StopDraft> = JSON.parse(str);

      if (d.stopType) setStopType(d.stopType);
      if (d.selectedUse) setSelectedUse(d.selectedUse);

      if (d.otName != null) setOtName(d.otName);
      if (d.otPhone != null) setOtPhone(d.otPhone);
      if (d.otEmail != null) setOtEmail(d.otEmail);
      if (d.otCustomerName != null) setOtCustomerName(d.otCustomerName);
      if (d.address != null) setAddress(d.address);

      if (d.addressLine1 != null) setLine1(d.addressLine1);
      if (d.addressLine2 != null) setLine2(d.addressLine2);
      if (d.city != null) setCity(d.city);
      if (d.region != null) setRegion(d.region);
      if (d.postal != null) setPostal(d.postal);
      if (d.country != null) setCountry(d.country);

      if (d.latitude !== undefined) setLatitude(d.latitude);
      if (d.longitude !== undefined) setLongitude(d.longitude);

      // save ids to hydrate after lists load
      draftIdsRef.current.customerId = d.customerId ?? null;
      draftIdsRef.current.vendorId = d.vendorId ?? null;
    } catch (e) {
      console.log('initiateForm error', e);
    }
  };

  const handleCustomers = async (businessId: number) => {
    try {
      const resp = await grabCustomers(businessId);
      setCustomers(resp.data);
    } catch {
      setCustomers([]);
      console.log('error grabbing customers');
    }
  };

  const handleSelected = async (ent: any) => {
    if (selectedUse === 'customer') {
      setSelectedCustomer(ent);
      setAddress(
        `${ent.address_line1}, ${ent.city}, ${ent.region} ${ent.postal_code}`,
      );
      setLine1(ent.address_line1);
      setCity(ent.city);
      setRegion(ent.region);
      setPostal(ent.postal_code);
      setCountry(ent.country_code);
      setLatitude(ent.latitude);
      setLongitude(ent.longitude);
      setSelectedName(ent.contact_name);
      setSelectedPhone(ent.contact_phone);
      setSelectedEmail(ent.contact_email);
      setSelectedCustomerName(ent.name);
    }
    if (selectedUse === 'vendor') {
      setSelectedVendor(ent);
      setAddress(
        `${ent.address_line1}, ${ent.city}, ${ent.region} ${ent.postal_code}`,
      );
      setLine1(ent.address_line1);
      setCity(ent.city);
      setRegion(ent.region);
      setPostal(ent.postal_code);
      setCountry(ent.country_code);
      setLatitude(ent.latitude);
      setLongitude(ent.longitude);
      setSelectedName(ent.contact_name);
      setSelectedPhone(ent.contact_phone);
      setSelectedEmail(ent.contact_email);
      setSelectedCustomerName(ent.name);
    }
  };

  const handleVendors = async (businessId: number) => {
    try {
      const resp = await grabVendors(businessId);
      setVendors(resp);
    } catch {
      setVendors([]);
      console.log('error grabbing vendors');
    }
  };

  useEffect(() => {}, [selectedCustomer, selectedVendor]);

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
    } catch (error) {
      console.error(error);
      Alert.alert('Error searching business addresses.');
    }
  };

  const getPlaceCoordinates = async (text: string) => {
    const options = {
      method: 'GET',
      url: 'https://google-maps-geocoding3.p.rapidapi.com/geocode',
      params: {
        address: text,
      },
      headers: {
        'x-rapidapi-key': 'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
        'x-rapidapi-host': 'google-maps-geocoding3.p.rapidapi.com',
      },
    };
    const customerPosition = await axios.request(options);
    setLatitude(parseFloat(customerPosition.data.latitude));
    setLongitude(parseFloat(customerPosition.data.longitude));
  };

  useEffect(() => {
    if (address.length > 2) {
      const fullAddress = address.split(', ');
      setLine1(fullAddress[0]);
      setCity(fullAddress[1]);
      setRegion(fullAddress[2]);
      setCountry('US');
    }
    getPlaceCoordinates(address);
  }, [address]);

  // Validation
  const valid = useMemo(() => {
    const hasAddress = line1.trim() && city.trim() && region.trim();
    if (!hasAddress) return false;
    if (!stopType) return false;
    if (!selectedUse) return false;

    if (selectedUse === 'customer') return !!selectedCustomer;
    if (selectedUse === 'vendor') return !!selectedVendor;
    // one-time needs at least a name
    if (selectedUse === 'one_time') return !!otName.trim();
    return false;
  }, [
    stopType,
    selectedCustomer,
    selectedVendor,
    otName,
    line1,
    city,
    region,
    selectedUse,
  ]);

  const onNext = async () => {
    if (!valid) return;

    const currentPayload = {
      route_id: routeId,
      business_id: business?.id,
      stop_type: stopType.toLowerCase(),
      depot_role: null,
      customer_id: selectedCustomer?.id || null,
      vendor_id: selectedVendor?.id || null,
      address_line1: line1.trim(),
      address_line2: line2.trim() || null,
      city: city.trim(),
      region: region.trim(),
      postal_code: postal.trim() || null,
      country_code: (country || 'US').toUpperCase(),
      latitude,
      longitude,
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
    };

    await AsyncStorage.setItem('step1Payload', JSON.stringify(currentPayload));
    nav.navigate('AddStopScreen2', {
      routeId: routeId,
      stopsCount: stopsCount,
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

  // UI labels for entity section
  const entityLabel =
    stopType === 'customer'
      ? 'Select Customer'
      : stopType === 'vendor'
      ? 'Select Vendor'
      : 'Contact (one-time)';

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
          Step 1 of 3 — Who & Where
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

        <Text style={[tw`text-lg font-semibold mb-3`, { color: colors.text }]}>
          Who
        </Text>

        <SegmentedControl
          value={selectedUse}
          onChange={handleSelectedUse}
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

        {/* Next CTA */}
      </ScrollView>
      <View style={tw`px-4 pb-4`}>
        <TouchableOpacity
          disabled={!valid}
          onPress={onNext}
          style={[
            tw`mt-6 px-4 py-3 rounded-2xl items-center`,
            {
              backgroundColor: valid
                ? colors.brand?.primary || '#2563eb'
                : colors.border,
            },
          ]}
        >
          <Text style={tw`text-white font-semibold`}>
            Next: Schedule & Requirements
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal: pick Customer/Vendor (separate from outer ScrollView -> no nested list warnings) */}
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

/* ───────────────────── UI Bits ───────────────────── */

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
          {/* Header */}
          <View style={tw`flex-row items-center mb-3`}>
            <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
              {title}
            </Text>
            <View style={tw`flex-1`} />
            <TouchableOpacity onPress={onClose}>
              <CloseIcon width={22} height={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
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
                    onPress={() => {
                      onSelect(item);
                    }}
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
                        <View>
                          <Text style={[tw`text-xs`, { color: colors.muted }]}>
                            {item.address_line1}. {item.city}, {item.region}{' '}
                            {item.postal_code}
                          </Text>
                        </View>
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

          {/* Footer */}
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
