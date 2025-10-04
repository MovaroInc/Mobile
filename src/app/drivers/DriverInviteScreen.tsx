// src/screens/drivers/DriverInviteScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import tw from 'twrnc';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSession } from '../../state/useSession';
import {
  validateEmailField,
  validateUsernameField,
} from '../../shared/lib/validators';
import { inviteDriver } from '../../shared/lib/InviteHelpers';

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // required
  username: string;
  0;
  notes: string;
  accessCode?: string; // optional one-time code
};

const initialForm: Form = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  username: '',
  notes: '',
  accessCode: '',
};

function isEmail(v: string) {
  return /^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/.test(v.trim());
}
function isPhone(v: string) {
  const d = v.replace(/[^\d]/g, '');
  return d.length >= 10 && d.length <= 15;
}
function nonEmpty(v: string) {
  return v.trim().length > 0;
}
function generate9DigitCode() {
  // Always 9 digits, left-padded with zeros if needed.
  return Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0');
}

export default function DriverInviteScreen() {
  const nav = useNavigation();
  const { colors } = useTheme();

  const { business, profile } = useSession();

  const [form, setForm] = useState<Form>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // async uniqueness checks (debounced)
  const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const emailTimer = useRef<NodeJS.Timeout | null>(null);
  const usernameTimer = useRef<NodeJS.Timeout | null>(null);

  const emailValid = isEmail(form.email);
  const phoneValid = isPhone(form.phone); // phone is required now

  const canSubmit = useMemo(() => {
    return (
      nonEmpty(form.firstName) &&
      nonEmpty(form.lastName) &&
      emailValid &&
      emailTaken === false &&
      nonEmpty(form.phone) &&
      phoneValid &&
      (usernameTaken === false || form.username.trim() === '') &&
      (form?.accessCode === '' || form?.accessCode?.length === 9)
    );
  }, [form, emailValid, phoneValid, emailTaken, usernameTaken]);

  useEffect(() => {
    console.log('validatingEmail', form.email);
    validatingEmail(form.email);
  }, [form.email]);

  useEffect(() => {
    console.log('validatingUsername', form.username);
    validatingUsername(form.username);
  }, [form.username]);

  const validatingEmail = async (email: string) => {
    const { valid, error } = await validateEmailField(email);
    console.log('validatingEmail', valid, error);
    if (error) throw error;
    setEmailTaken(!valid);
  };

  const validatingUsername = async (username: string) => {
    const { valid, error } = await validateUsernameField(username);
    if (error) throw error;
    setUsernameTaken(valid);
  };

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(prev => ({ ...prev, [key]: value?.toLowerCase() }));
  }

  async function handleSubmit() {
    if (!canSubmit) {
      Alert.alert(
        'Check form',
        'Please fix the validation errors and try again.',
      );
      return;
    }
    setSubmitting(true);
    try {
      // Shape the payload for your server (DOB and address removed)
      const payload = {
        business_id: business?.id,
        invited_by_profile_id: profile?.id,
        invited_role: 'driver',
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        username: form.username ? form.username.trim().toLowerCase() : null,
        invited_email: form.email.toLowerCase(),
        invited_phone: form.phone.trim(), // required
        notes: form.notes || null,
        attempts: 0,
        max_attempts: 3,
        reference_code: form.accessCode || null, // optional
        code_hash: form.accessCode,
        status: 'pending',
        sent_at: new Date().toISOString(),
      };

      console.log('inviting driver', JSON.stringify(payload, null, 2));
      const res = await inviteDriver(payload);
      console.log('res', res);

      Alert.alert('Driver invited', 'We sent an invite email to the driver.');

      setForm(initialForm);
      setEmailTaken(null);
      setUsernameTaken(null);
    } catch (err: any) {
      Alert.alert('Invite failed', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
      nav.goBack();
    }
  }

  function handleGenerateCode() {
    update('accessCode', generate9DigitCode());
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[tw`flex-1 px-4 pt-4`, { backgroundColor: colors.bg }]}
    >
      <Text style={tw`text-white text-2xl font-semibold mb-2`}>
        Invite Driver
      </Text>
      <Text style={tw`text-gray-400 mb-6`}>
        Collect the driver’s basic details. We’ll send them an invite to
        complete setup.
      </Text>
      <ScrollView
        contentContainerStyle={tw`pb-24`}
        keyboardShouldPersistTaps="handled"
      >
        {/* Role (fixed) */}
        <View style={tw`flex-row items-center mb-4`}>
          <Text style={tw`text-gray-300 mr-2`}>Role:</Text>
          <View style={tw`py-1`}>
            <Text style={tw`text-blue-300 font-bold`}>Driver</Text>
          </View>
        </View>

        {/* Name */}
        <View style={tw`flex-row gap-3`}>
          <Field
            label="First name *"
            value={form.firstName}
            onChangeText={v => update('firstName', v)}
            autoCapitalize="words"
            placeholder="Jane"
            containerStyle={tw`flex-1`}
            error={!nonEmpty(form.firstName) ? 'Required' : undefined}
          />
          <Field
            label="Last name *"
            value={form.lastName}
            onChangeText={v => update('lastName', v)}
            autoCapitalize="words"
            placeholder="Doe"
            containerStyle={tw`flex-1`}
            error={!nonEmpty(form.lastName) ? 'Required' : undefined}
          />
        </View>

        {/* Email */}
        <Field
          label="Email *"
          value={form.email}
          onChangeText={v => update('email', v.toLowerCase())}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="driver@company.com"
          error={
            !emailValid
              ? 'Invalid email'
              : emailTaken === true
              ? 'Email already in use'
              : undefined
          }
          right={
            emailValid ? (
              emailTaken === null ? (
                <Text style={tw`text-gray-400`}>checking…</Text>
              ) : emailTaken ? (
                <Text style={tw`text-red-400`}>taken</Text>
              ) : (
                <Text style={tw`text-green-400`}>available</Text>
              )
            ) : undefined
          }
        />

        {/* Phone (required) */}
        <Field
          label="Phone *"
          value={form.phone}
          onChangeText={v => update('phone', v)}
          keyboardType="phone-pad"
          placeholder="+1 555 123 4567"
          error={
            !nonEmpty(form.phone)
              ? 'Required'
              : !phoneValid
              ? 'Invalid phone'
              : undefined
          }
        />

        {/* Username (optional) */}
        <Field
          label="Username"
          value={form.username}
          onChangeText={v =>
            update('username', v.replace(/\s+/g, '').toLowerCase())
          }
          autoCapitalize="none"
          placeholder="janed"
          right={
            form.username ? (
              usernameTaken === null ? (
                <Text style={tw`text-gray-400`}>checking…</Text>
              ) : usernameTaken ? (
                <Text style={tw`text-red-400`}>taken</Text>
              ) : (
                <Text style={tw`text-green-400`}>available</Text>
              )
            ) : undefined
          }
        />

        {/* Notes */}
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={v => update('notes', v)}
          placeholder="Anything the driver should know…"
          multiline
        />

        {/* Access Code (optional) */}
        <View style={tw`mt-6`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={tw`text-white font-semibold`}>
              One-time access code
            </Text>
            <TouchableOpacity
              onPress={handleGenerateCode}
              style={tw`px-3 py-1 rounded-lg bg-blue-600/20 border border-blue-600`}
            >
              <Text style={tw`text-blue-300`}>Generate</Text>
            </TouchableOpacity>
          </View>
          <Field
            label="Code *"
            value={form.accessCode || ''}
            onChangeText={v =>
              update('accessCode', v.replace(/[^\d]/g, '').slice(0, 9))
            }
            placeholder="9-digit code (optional)"
            error={
              !nonEmpty(form.accessCode) || form.accessCode.length !== 9
                ? 'Invalid code'
                : undefined
            }
          />
        </View>

        {/* Submit */}
      </ScrollView>
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
        style={tw.style(
          `mt-4 rounded-2xl py-3 items-center`,
          canSubmit && !submitting ? `bg-[#005ad0]` : `bg-[#1a2a3b]`,
        )}
      >
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <Text style={tw`text-white font-semibold`}>Send Invite</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => nav.goBack()}
        style={tw`mt-1 py-3 items-center mb-2`}
      >
        <Text style={tw`text-gray-400`}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

/** Simple labeled input with dark theme + error text */
function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  right?: React.ReactNode;
  containerStyle?: any;
  multiline?: boolean;
  maxLength?: number;
}) {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    autoCapitalize,
    error,
    right,
    containerStyle,
    multiline,
    maxLength,
  } = props;
  const { colors } = useTheme();
  return (
    <View style={tw.style(`mb-4`, containerStyle)}>
      <View style={tw`flex-row justify-between items-end mb-1`}>
        <Text style={tw`text-gray-300`}>{label}</Text>
        {right}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          tw`text-white rounded-xl px-3 py-3 border`,
          {
            borderColor: error ? '#ef4444' : colors.border,
            backgroundColor: colors.bg,
          },
        ]}
        multiline={multiline}
        maxLength={maxLength}
      />
      {!!error && <Text style={tw`text-red-400 mt-1`}>{error}</Text>}
    </View>
  );
}
