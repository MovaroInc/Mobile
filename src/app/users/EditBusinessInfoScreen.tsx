import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
// If you already have these helpers in the new stack, keep using them.
// Otherwise, swap to your new api layer call.
import {
  getCompanyBasedOnUserId,
  updateBusinessInfo,
} from '../../services/CompanyService';

type PlacePrediction = {
  description: string;
  place_id: string;
};

export default function EditBusinessInfoScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { profile, business } = useSession();

  const [businessName, setBusinessName] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fallback if session.business not populated yet
  const [businessId, setBusinessId] = useState<number | null>(null);

  // ----- bootstrap -----
  useEffect(() => {
    // prefer session first
    if (business?.id) {
      setBusinessId(business.id);
      setBusinessName(business.name || '');
      if ((business as any)?.address) {
        setSelectedAddress((business as any).address);
        setAddressQuery((business as any).address);
      }
    }
  }, [business?.id]);

  useEffect(() => {
    // fallback: fetch by user id if business not present
    (async () => {
      if (businessId || !profile?.id) return;
      try {
        const rows = await getCompanyBasedOnUserId(profile.id);
        const row = rows?.[0];
        if (row?.Business?.id) {
          setBusinessId(row.Business.id);
          setBusinessName(row.Business.name || '');
          setSelectedAddress(row.Business.address || '');
          setAddressQuery(row.Business.address || '');
        }
      } catch {
        // non-fatal
      }
    })();
  }, [businessId, profile?.id]);

  // ----- address autocomplete (debounced) -----
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.length < 3) {
      setSuggestions([]);
      return;
    }
    if (q === lastQueryRef.current) return;
    lastQueryRef.current = q;

    setLoadingSuggestions(true);
    try {
      const resp = await axios.request({
        method: 'GET',
        url: 'https://google-place-autocomplete-and-place-info.p.rapidapi.com/maps/api/place/autocomplete/json',
        params: { input: q },
        headers: {
          // TODO: move to env
          'x-rapidapi-key':
            'c077600dd0msh70cad04baf5f0e2p187ab4jsn23535e260f32',
          'x-rapidapi-host':
            'google-place-autocomplete-and-place-info.p.rapidapi.com',
        },
      });
      const preds: PlacePrediction[] = resp?.data?.predictions || [];
      setSuggestions(preds);
    } catch (e) {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const onChangeAddressQuery = (v: string) => {
    setAddressQuery(v);
    setSelectedAddress(''); // clear selection once user edits again
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 320);
  };

  // ----- save -----
  const canSave = useMemo(
    () =>
      !!businessId &&
      !!businessName.trim() &&
      !!(selectedAddress || addressQuery).trim() &&
      !saving,
    [businessId, businessName, selectedAddress, addressQuery, saving],
  );

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Check form', 'Please enter a name and address.');
      return;
    }
    try {
      setSaving(true);
      const addr = selectedAddress || addressQuery;
      const resp = await updateBusinessInfo(
        businessId!,
        businessName.trim(),
        addr.trim(),
      );
      if ((resp as any)?.error) {
        throw new Error((resp as any)?.error?.message || 'Update failed');
      }
      Alert.alert('Updated', 'Business info saved.');
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to save business info.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-3 pb-2 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold ml-2`, { color: colors.text }]}>
          Edit Business Info
        </Text>
      </View>

      {/* Body */}
      <View style={tw`px-4 pb-8`}>
        {/* Business Name */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Business name
        </Text>
        <TextInput
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Enter business name"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={[
            tw`rounded-xl px-3 py-3 mb-4`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {/* Address */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Business address
        </Text>
        <TextInput
          value={addressQuery}
          onChangeText={onChangeAddressQuery}
          placeholder="Search address"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={[
            tw`rounded-xl px-3 py-3 mb-2`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {loadingSuggestions ? (
          <ActivityIndicator style={tw`mt-2 mb-2`} />
        ) : null}

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions}
          keyExtractor={(it, idx) => it.place_id || String(idx)}
          style={tw`max-h-60`}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedAddress(item.description);
                setAddressQuery(item.description);
                setSuggestions([]);
                Keyboard.dismiss();
              }}
              style={[
                tw`px-3 py-2 rounded-xl mb-1`,
                {
                  backgroundColor: colors.main,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text }}>{item.description}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            addressQuery.length >= 3 && !loadingSuggestions ? (
              <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
                No matches.
              </Text>
            ) : null
          }
        />

        {!!(selectedAddress || addressQuery) && (
          <Text style={[tw`text-xs mt-3`, { color: colors.muted }]}>
            Selected:{' '}
            <Text style={{ color: colors.text }}>
              {selectedAddress || addressQuery}
            </Text>
          </Text>
        )}

        {/* Save */}
        <TouchableOpacity
          disabled={!canSave}
          onPress={handleSave}
          style={tw.style(
            `rounded-2xl py-3 items-center mt-6`,
            !canSave && `opacity-60`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          )}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-semibold`}>Save Business Info</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
