// src/app/profile/UpdateProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';

const MIN_USERNAME = 3;
const MAX_USERNAME = 20;
const USERNAME_RE = /^[a-z0-9._-]+$/; // simple, predictable handles

export default function UpdateProfileScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { profile } = useSession();

  const [username, setUsername] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  // username availability
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUsername((profile?.username || '').toLowerCase());
    setFirst(profile?.first_name || '');
    setLast(profile?.last_name || '');
  }, [profile?.username, profile?.first_name, profile?.last_name]);

  // derived validity
  const usernameValidFormat =
    username.length >= MIN_USERNAME &&
    username.length <= MAX_USERNAME &&
    USERNAME_RE.test(username);

  const canSave = useMemo(() => {
    const changed =
      username !== (profile?.username || '').toLowerCase() ||
      first !== (profile?.first_name || '') ||
      last !== (profile?.last_name || '');
    const usernameOk =
      username.trim().length === 0 || // allow keeping blank if your backend supports
      (usernameValidFormat && available !== false);
    const namesOk = first.trim().length > 0 && last.trim().length > 0;
    return changed && usernameOk && namesOk && !saving && !checking;
  }, [
    username,
    first,
    last,
    profile?.username,
    profile?.first_name,
    profile?.last_name,
    available,
    saving,
    checking,
    usernameValidFormat,
  ]);

  // debounced username availability check
  useEffect(() => {
    // reset availability if unchanged or too short
    if (username === (profile?.username || '').toLowerCase()) {
      setAvailable(true);
      return;
    }
    if (username.trim().length === 0) {
      setAvailable(null);
      return;
    }
    if (!usernameValidFormat) {
      setAvailable(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setChecking(true);
    timerRef.current = setTimeout(async () => {
      try {
        // Adjust endpoint if yours differs:
        // Expecting { success, data: { available: boolean } }
        const res = await api.get<{
          success: boolean;
          data: { available: boolean } | null;
          message?: string | null;
        }>(`/users/check-username?u=${encodeURIComponent(username)}`);

        if (res?.success && res?.data) {
          setAvailable(!!res.data.available);
        } else {
          // if server didn't return expected shape, treat as unknown (don’t block)
          setAvailable(null);
        }
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const onSave = async () => {
    if (!canSave) return;

    try {
      setSaving(true);
      // Adjust endpoint to your backend; common pattern used in your app:
      // Expecting { success, data, message }
      const payload = {
        id: profile?.id, // if your API needs it
        username: username || null, // allow null if optional in DB
        first_name: first.trim(),
        last_name: last.trim(),
      };

      const { success, message } = await api.post<{
        success: boolean;
        data: any;
        message?: string | null;
      }>('/users/update-profile', payload);

      if (!success) throw new Error(message || 'Failed to update profile.');

      Alert.alert('Saved', 'Your profile was updated.');
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Please try again.');
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
          Update Profile
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`px-4 pb-10`}
      >
        {/* Username */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Username
        </Text>
        <TextInput
          value={username}
          onChangeText={v => {
            setDirty(true);
            setUsername(v.trim().toLowerCase());
          }}
          placeholder="yourhandle"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={[
            tw`rounded-xl px-3 py-3 mb-1`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />
        <View style={tw`flex-row items-center mb-3`}>
          {checking ? (
            <ActivityIndicator />
          ) : username.length > 0 ? (
            <>
              {!usernameValidFormat ? (
                <Text style={[tw`text-xs`, { color: '#ef4444' }]}>
                  Use 3–20 chars: a–z, 0–9, . _ -
                </Text>
              ) : available === false ? (
                <Text style={[tw`text-xs`, { color: '#ef4444' }]}>
                  That username is taken
                </Text>
              ) : available === true ? (
                <Text style={[tw`text-xs`, { color: '#22c55e' }]}>
                  Username is available
                </Text>
              ) : (
                <Text style={[tw`text-xs`, { color: colors.muted }]}>
                  Unable to verify availability
                </Text>
              )}
            </>
          ) : null}
        </View>

        {/* First name */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          First name
        </Text>
        <TextInput
          value={first}
          onChangeText={setFirst}
          placeholder="First name"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={[
            tw`rounded-xl px-3 py-3 mb-3`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {/* Last name */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Last name
        </Text>
        <TextInput
          value={last}
          onChangeText={setLast}
          placeholder="Last name"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={[
            tw`rounded-xl px-3 py-3 mb-6`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {/* Save */}
        <TouchableOpacity
          disabled={!canSave}
          onPress={onSave}
          style={tw.style(
            `rounded-2xl py-3 items-center`,
            canSave ? `` : `opacity-60`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          )}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-semibold`}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Helper text */}
        {dirty ? (
          <Text style={[tw`text-xs mt-3`, { color: colors.muted }]}>
            Tip: Leaving username blank will keep your current handle.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
