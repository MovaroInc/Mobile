// src/app/profile/ChangePasswordScreen.tsx
import React, { useMemo, useState } from 'react';
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
import { supabase } from '../../shared/lib/supabase';

const isStrongPassword = (pw: string) =>
  pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

export default function ChangePasswordScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { profile } = useSession();

  const [current, setCurrent] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const strong = isStrongPassword(nextPw);
  const matches = nextPw.length > 0 && nextPw === confirm;

  const canSubmit = useMemo(
    () => !!current && strong && matches && !loading,
    [current, strong, matches, loading],
  );

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Check form', 'Please fix the validation errors.');
      return;
    }

    try {
      setLoading(true);

      // Re-auth with current password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: current,
      });
      if (authErr) {
        Alert.alert('Current password incorrect', 'Please try again.');
        return;
      }

      // Update password
      const { error: updErr } = await supabase.auth.updateUser({
        password: nextPw,
      });
      if (updErr) {
        Alert.alert('Update failed', updErr.message || 'Please try again.');
        return;
      }

      Alert.alert('Success', 'Your password has been updated.');
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
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
          Change Password
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`px-4 pb-10`}
      >
        {/* Current password */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Current password
        </Text>
        <TextInput
          value={current}
          onChangeText={setCurrent}
          placeholder="Enter current password"
          placeholderTextColor={colors.muted}
          secureTextEntry
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

        {/* New password */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          New password
        </Text>
        <TextInput
          value={nextPw}
          onChangeText={setNextPw}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.muted}
          secureTextEntry
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
        {!strong ? (
          <Text style={[tw`text-xs mb-3`, { color: '#ef4444' }]}>
            Must be 8+ chars and include at least one letter and one number.
          </Text>
        ) : null}

        {/* Confirm */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
          Confirm new password
        </Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter password"
          placeholderTextColor={colors.muted}
          secureTextEntry
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
        {confirm.length > 0 && !matches ? (
          <Text style={[tw`text-xs mb-3`, { color: '#ef4444' }]}>
            Passwords do not match.
          </Text>
        ) : null}

        {/* Save */}
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={onSubmit}
          style={tw.style(
            `rounded-2xl py-3 items-center`,
            !canSubmit && `opacity-60`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          )}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-semibold`}>Update Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
