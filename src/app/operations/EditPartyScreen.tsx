import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import tw from 'twrnc';
import { useSession } from '../../state/useSession';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import { api } from '../../shared/lib/api'; // <- your axios/fetch wrapper
import { ChevronLeft } from 'react-native-feather';
import { useTheme } from '../../shared/hooks/useTheme';
import axios from 'axios';
import {
  createCustomer,
  createVendor,
  editCustomer,
  editVendor,
} from '../../shared/lib/CustomerVendorApi';

type Mode = 'customer' | 'vendor';

type RouteParams = { mode: Mode };

const isE164 = (v: string) => /^\+?[1-9]\d{6,14}$/.test(v.trim());
const normalizePhone = (v: string) => {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  // assume US if 10 digits
  if (digits.length === 10) return `+1${digits}`;
  return `${digits}`;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export default function EditPartyScreen() {
  const route = useRoute<any>();
  const { record, mode } = route.params;
  const { colors } = useTheme();
  const nav = useNavigation<any>();

  const { business } = useSession(); // expects business?.id

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [query, setQuery] = useState('');

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState(''); // state/province
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('US'); // ISO-2

  const [loading, setLoading] = useState(false);

  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (record) {
        setName(record.name);
        setPhone(record.phone);
        setEmail(record.email);
        setContactName(record.contact_name);
        setContactPhone(record.contact_phone);
        setLine1(record.address_line1);
        setLine2(record.address_line2);
        setCity(record.city);
        setRegion(record.region);
        setPostal(record.postal_code || '');
        setCountry(record.country_code);
        setLatitude(record.latitude);
        setLongitude(record.longitude);
      }
    }, [record]),
  );

  const valid = useMemo(() => {
    return (
      name.trim().length > 1 &&
      isE164(phone) &&
      contactName.trim().length > 1 &&
      isE164(contactPhone) &&
      line1.trim().length > 3 &&
      city.trim().length > 1 &&
      region.trim().length > 1 &&
      postal.trim().length > 0 &&
      !!business?.id
    );
  }, [
    name,
    phone,
    contactName,
    contactPhone,
    line1,
    city,
    region,
    postal,
    business?.id,
  ]);

  useEffect(() => {
    if (address.length > 2) {
      const fullAddress = address.split(', ');
      setLine1(fullAddress[0]);
      setCity(fullAddress[1]);
      setRegion(fullAddress[2]);
      setCountry(fullAddress[3]);
    }
    getPlaceCoordinates(address);
  }, [address]);

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
    console.log(customerPosition);
    setLatitude(parseFloat(customerPosition.data.latitude));
    setLongitude(parseFloat(customerPosition.data.longitude));
  };

  const onSave = async () => {
    if (!valid) {
      Alert.alert('Missing info', 'Please fill all required fields.');
      return;
    }
    try {
      setLoading(true);

      const payload = {
        business_id: business!.id,
        slug: slugify(name),
        name: name.trim(),
        phone: normalizePhone(phone),
        email: email || null,
        contact_name: contactName.trim(),
        contact_phone: normalizePhone(contactPhone),
        address_line1: line1.trim(),
        address_line2: line2 || null,
        city: city.trim(),
        region: region.trim(),
        postal_code: postal.trim(),
        country_code: (country.slice(0, 2) || '').toUpperCase(),
        latitude,
        longitude,
      };

      // Adjust endpoints to yours if different
      if (mode === 'customer') {
        const res = await editCustomer(record.id, payload);
        console.log('editCustomer', res);
        if (!res?.data.id)
          throw new Error(res?.message || 'Failed to create customer');
        Alert.alert('Saved', 'Customer created');
        nav.goBack();
      } else {
        const res = await editVendor(record.id, payload);
        console.log('editVendor', res);
        if (!res?.data.id)
          throw new Error(res?.message || 'Failed to create vendor');
        Alert.alert('Saved', 'Vendor created');
        nav.goBack();
      }
    } catch (e: any) {
      console.log(
        '[AddPartyScreen] save error:',
        e?.response?.data || e?.message || e,
      );
      Alert.alert(
        'Save failed',
        e?.response?.data?.message || e?.message || 'Unknown error',
      );
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'customer' ? 'Add Customer' : 'Add Vendor';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
    >
      {/* Simple header */}
      <View style={tw`px-2 pt-4 pb-2 flex-row items-center justify-start`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[tw`text-2xl font-bold ml-2`, { color: colors.text }]}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-24`}>
        <SectionTitle text="Business" />
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          colors={colors}
          required={true}
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={v => setPhone(normalizePhone(v))}
          placeholder="555 123 4567"
          colors={colors}
          keyboardType="phone-pad"
          required={true}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          colors={colors}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <SectionTitle text="Primary Contact" />
        <Field
          label="Contact Name"
          value={contactName}
          onChangeText={setContactName}
          colors={colors}
          required={true}
        />
        <Field
          label="Contact Phone"
          value={contactPhone}
          onChangeText={v => setContactPhone(normalizePhone(v))}
          placeholder="555 987 6543"
          colors={colors}
          keyboardType="phone-pad"
          required={true}
        />
        <Field
          label="Contact Email"
          value={contactEmail}
          onChangeText={setContactEmail}
          colors={colors}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <SectionTitle text="Address" />
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
        {/* ------------------------------------------------------------ */}
        <View style={tw`w-full flex-row items-center justify-between mb-2`}>
          <View
            style={[
              tw`w-1/3 h-.5 rounded-full`,
              { backgroundColor: colors.border },
            ]}
          />
          <View>
            <Text style={[tw`text-sm`, { color: colors.text }]}>OR</Text>
          </View>
          <View
            style={[
              tw`w-1/3 h-.5 rounded-full`,
              { backgroundColor: colors.border },
            ]}
          />
        </View>

        <Field
          label="Address Line 1"
          value={line1}
          onChangeText={setLine1}
          colors={colors}
          required={true}
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
            label="City"
            value={city}
            onChangeText={setCity}
            colors={colors}
            required={true}
          />
          <Spacer />
          <Field
            flex
            label="Region/State"
            value={region}
            onChangeText={setRegion}
            colors={colors}
            required={true}
          />
        </Row>
        <Row>
          <Field
            flex
            label="Postal Code"
            value={postal}
            onChangeText={setPostal}
            colors={colors}
            required={true}
          />
          <Spacer />
          <Field
            flex
            label="Country Code"
            value={country}
            onChangeText={(v: string) => setCountry((v || '').toUpperCase())}
            colors={colors}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="US"
            required={true}
          />
        </Row>
      </ScrollView>

      {/* Footer */}
      <View style={tw`px-4 pb-6`}>
        <TouchableOpacity
          onPress={onSave}
          disabled={!valid || loading}
          style={[
            tw`px-4 py-3 rounded-2xl items-center`,
            {
              backgroundColor: valid
                ? colors.brand.primary
                : 'rgba(255,255,255,0.15)',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-semibold`}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** UI bits */
function SectionTitle({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[tw`text-lg font-semibold mt-3 mb-1`, { color: colors.text }]}>
      {text}
    </Text>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={tw`flex-row`}>{children}</View>;
}
function Spacer() {
  return <View style={tw`w-2`} />;
}
function Field(props: any) {
  const { label, colors, flex, required, ...rest } = props;
  return (
    <View style={[flex ? tw`flex-1` : undefined, tw`mb-3`]}>
      <Text style={tw`text-gray-400 text-xs mb-1`}>
        {label} {required && <Text style={tw`text-red-500`}>*</Text>}
      </Text>
      <TextInput
        {...rest}
        placeholderTextColor={'#9CA3AF'}
        style={[
          tw`px-3 py-2 rounded-xl`,
          { color: colors.text, backgroundColor: colors.border },
        ]}
      />
    </View>
  );
}

function FieldSuggestions(props: any) {
  const {
    label,
    colors,
    flex,
    suggestions,
    setSuggestions,
    setQuery,
    setAddress,
    ...rest
  } = props;
  return (
    <View style={[flex ? tw`flex-1` : undefined, tw`mb-3`]}>
      <Text style={tw`text-gray-400 text-xs mb-1`}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={'#9CA3AF'}
        style={[
          tw`px-3 py-2 rounded-xl ${
            suggestions.length > 0 ? 'rounded-b-none' : ''
          }`,
          { color: colors.text, backgroundColor: colors.border },
        ]}
      />
      <FlatList
        data={suggestions}
        style={{
          backgroundColor: colors.border,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        }}
        renderItem={({ item }) => {
          return (
            <TouchableOpacity
              onPress={() => {
                setQuery(item.description);
                setAddress(item.description);
                setSuggestions([]);
              }}
              style={[
                tw`p-3 border-b border-gray-200`,
                {
                  backgroundColor: colors.border,
                  borderBottomColor: colors.borderSecondary,
                },
              ]}
            >
              <Text style={[tw`text-sm`, { color: colors.text }]}>
                {item.description}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
