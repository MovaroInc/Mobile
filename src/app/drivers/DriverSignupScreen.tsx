// src/screens/auth/DriverSignupScreen.tsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from 'react-native';
import tw from 'twrnc';
import {
  useNavigation,
  useRoute,
  RouteProp,
  useTheme,
} from '@react-navigation/native';
import { Linking } from 'react-native';
import { supabase } from '../../api/supabase';
import { ChevronLeft } from 'react-native-feather';
import {
  getInviteByAccessCode,
  updateInviteWIthAccepted,
} from '../../shared/lib/InviteHelpers';
import { api } from '../../shared/lib/api';
import {
  createEmployeeAccount,
  createUserAccount,
  updateProfileWithEmployeeId,
} from '../../shared/lib/authHelpers';
import { getBusinessById } from '../../shared/lib/BusinessHelpers';
import { getSubscriptionByBusinessId } from '../../shared/lib/SubscriptionHelpers';
import { grabCurrentLocation } from '../../shared/lib/locations';

type RootStackParamList = {
  DriverSignup: { inviteId?: string } | undefined;
};

type Prefill = {
  inviteId: string;
  email: string;
  first_name: string;
  last_name: string;
  username?: string | null;
  business_id?: number;
};

function isStrongPassword(pw: string) {
  // min 8 chars; at least one letter and one number
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

function nonEmpty(s: string) {
  return s.trim().length > 0;
}

export default function DriverSignupScreen() {
  const nav = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'DriverSignup'>>();
  const initialInviteIdFromRoute = route.params?.inviteId;
  const claimTokenRef = useRef<string | null>(null);

  // form state
  const [inviteId, setInviteId] = useState<string | null>(
    initialInviteIdFromRoute ?? null,
  );
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);

  const [code, setCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [invite, setInvite] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [location, setLocation] = useState<{
    longitude: number | null;
    latitude: number | null;
  }>({ longitude: null, latitude: null });
  // ---------- Deep link: read claim token 't' and validate ----------
  useEffect(() => {
    // Initial URL (cold start)
    Linking.getInitialURL().then(url => {
      if (!url) return;
      const u = new URL(url);
      const t = u.searchParams.get('t');
      if (t) claimTokenRef.current = t;
      // if we have :inviteId in route, validate
      if (initialInviteIdFromRoute && t) {
        validateByToken(initialInviteIdFromRoute, t);
      }
    });

    // Warm start (app already open)
    const sub = Linking.addEventListener('url', ({ url }) => {
      const u = new URL(url);
      const t = u.searchParams.get('t');
      if (t) claimTokenRef.current = t;
      const maybeInviteId = u.pathname.split('/').pop();
      if (maybeInviteId && t) {
        setInviteId(maybeInviteId);
        validateByToken(maybeInviteId, t);
      }
    });

    return () => {
      // @ts-ignore RN <=0.71 signature
      sub?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Username availability (debounced)
  useEffect(() => {
    const uname = username.trim().toLowerCase();
    if (!uname) {
      setUsernameTaken(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { count, error } = await supabase
          .from('Profile')
          .select('id', { count: 'exact', head: true })
          .eq('username', uname);
        if (error) throw error;
        setUsernameTaken((count || 0) > 0);
      } catch {
        setUsernameTaken(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  // Auto-verify code when length == 9 (manual path)
  useEffect(() => {
    if (
      code.replace(/\D/g, '').length === 9 &&
      !codeVerified &&
      !verifyingCode &&
      !claimTokenRef.current
    ) {
      verifyCodeManual(code);
    } else if (code.length < 9) {
      setCodeVerified(false);
      setCodeError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function validateByToken(invId: string, token: string) {
    try {
      setVerifyingCode(true);
      setCodeError(null);

      // Call your server to validate the claim token, return prefill
      // Expected response: { status:'ok', prefill: { inviteId, email, first_name, last_name, username } }
      const res = await api.post('/invites/validate', {
        inviteId: invId,
        claimToken: token,
      });

      if (res?.status !== 'ok' || !res?.prefill) {
        throw new Error(res?.error || 'Invite not valid');
      }

      const pf: Prefill = res.prefill;
      prefillForm(pf);
      setInviteId(pf.inviteId);
      setCodeVerified(true); // token path: we can consider code "verified" once server validated token
    } catch (e: any) {
      setCodeVerified(false);
      setCodeError(e?.message || 'Unable to validate invite.');
    } finally {
      setVerifyingCode(false);
    }
  }

  async function verifyCodeManual(inputCode: string) {
    try {
      setVerifyingCode(true);
      setCodeError(null);

      // Ask server to resolve prefill by code (no auth user yet)
      // Endpoint idea: POST /invites/lookup-by-code { code } -> { status:'ok', prefill }
      const res = await getInviteByAccessCode(inputCode.replace(/\D/g, ''));

      if (res?.data.length === 0) {
        throw new Error('Code not valid.');
      }

      const pf: Prefill = res.data;
      prefillForm(pf);
      setInviteId(pf.inviteId);
      setCodeVerified(true);
      getSubscription(pf.business_id);
    } catch (e: any) {
      setCodeVerified(false);
      setCodeError(e?.message || 'Code not valid.');
    } finally {
      setVerifyingCode(false);
    }
  }

  const getSubscription = async (businessId: number) => {
    const { data, error } = await getSubscriptionByBusinessId(businessId);
    if (error) {
      Alert.alert('Error', error.message);
    }
    console.log('subscription', data[0]);
    setSubscription(data[0]);
  };

  function prefillForm(pf: Prefill) {
    setEmail(pf.invited_email || '');
    setPhone(pf.invited_phone || '');
    setFirstName(pf.first_name || '');
    setLastName(pf.last_name || '');
    setUsername((pf.username || '').toLowerCase());
    setBusinessId(pf.business_id || null);
    setInvite(pf);
  }

  const passwordsMatch = password === password2 && password.length > 0;
  const passwordStrong = isStrongPassword(password);

  const canSubmit = useMemo(() => {
    return (
      codeVerified &&
      nonEmpty(email) &&
      nonEmpty(firstName) &&
      nonEmpty(lastName) &&
      passwordStrong &&
      passwordsMatch &&
      (usernameTaken === false || username.trim() === '')
    );
  }, [
    codeVerified,
    email,
    firstName,
    lastName,
    passwordStrong,
    passwordsMatch,
    usernameTaken,
    username,
  ]);

  useLayoutEffect(() => {
    const grabLocation = async () => {
      const { longitude, latitude } = await grabCurrentLocation();
      setLocation({ longitude, latitude });
    };
    grabLocation();
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Check form', 'Please fix the validation errors.');
      return;
    }

    try {
      setSubmitting(true);
      console.log('subscription', subscription);

      const { data, error } = await createUserAccount(
        email,
        password,
        username,
        firstName,
        lastName,
        phone,
        location.latitude,
        location.longitude,
        businessId,
        null,
        null,
        subscription?.id ?? null,
        null,
        'driver',
        'active',
      );

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      console.log('create account data', data);

      const { data: employeeData, error: employeeError } =
        await createEmployeeAccount(
          invite.business_id,
          data.data.id,
          'active',
          'full_time',
          'Driver',
          null,
          invite.invited_by_profile_id,
          new Date().toISOString(),
          null,
          true,
          null,
          null,
          null,
          null,
          phone,
          email,
          null,
          null,
          {},
          'available',
        );

      if (employeeError) {
        Alert.alert('Error', employeeError.message);
        return;
      }

      const { error: updateProfileError } = await updateProfileWithEmployeeId(
        invite.business_id,
        employeeData.data.id,
        data.data.id,
      );

      if (updateProfileError) {
        Alert.alert('Error', updateProfileError.message);
        return;
      }

      const { error: updateInviteError } = await updateInviteWIthAccepted(
        invite.id,
        {
          status: 'accepted',
          accepted_by_profile_id: data.data.id,
          accepted_at: new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      );

      if (updateInviteError) {
        Alert.alert('Error', updateInviteError.message);
        return;
      }

      nav.goBack();
      Alert.alert(
        'Success',
        'Your account has been created. Please check your email for verification.',
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
    >
      <View style={tw`px-4 pt-4 pb-2`}>
        <View style={tw`flex-row items-center gap-2`}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <ChevronLeft color={colors.text} height={24} width={24} />
          </TouchableOpacity>
          <Text style={tw`text-white text-2xl font-semibold mb-2`}>
            Sign up as Driver
          </Text>
        </View>
        <Text style={tw`text-gray-400 mb-6`}>
          Your details were shared by your manager. Confirm and create your
          password to finish.
        </Text>
        <ScrollView
          contentContainerStyle={tw`pb-8`}
          keyboardShouldPersistTaps="handled"
        >
          {/* Access Code (manual fallback) */}
          {!claimTokenRef.current && (
            <Field
              label="Access code"
              value={code}
              onChangeText={v => setCode(v.replace(/[^\d]/g, '').slice(0, 9))}
              placeholder="9-digit code"
              keyboardType="number-pad"
              right={
                verifyingCode ? (
                  <Text style={tw`text-gray-400`}>verifying…</Text>
                ) : codeVerified ? (
                  <Text style={tw`text-green-400`}>verified</Text>
                ) : code.length >= 1 && code.length < 9 ? (
                  <Text style={tw`text-gray-400`}>{`${code.length}/9`}</Text>
                ) : codeError ? (
                  <Text style={tw`text-red-400`}>invalid</Text>
                ) : undefined
              }
              error={codeError || undefined}
            />
          )}

          <View style={tw`flex-row gap-3`}>
            <Field
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              containerStyle={tw`flex-1`}
              error={!nonEmpty(firstName) ? 'Required' : undefined}
            />
            <Field
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              containerStyle={tw`flex-1`}
              error={!nonEmpty(lastName) ? 'Required' : undefined}
            />
          </View>

          {/* Email (locked) */}
          <Field
            label="Create password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            error={
              password.length > 0 && !passwordStrong
                ? 'Must be 8+ chars, include a letter and a number'
                : undefined
            }
          />
          <Field
            label="Confirm password"
            value={password2}
            onChangeText={setPassword2}
            placeholder="Re-enter password"
            secureTextEntry
            error={
              password2.length > 0 && !passwordsMatch
                ? 'Passwords do not match'
                : undefined
            }
          />

          <Field
            label="Email"
            value={email}
            onChangeText={() => {}}
            placeholder="email@example.com"
            keyboardType="email-address"
            editable={false}
            right={<Text style={tw`text-gray-400`}>locked</Text>}
          />

          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="949 494 4994"
            keyboardType="phone-pad"
            editable={false}
            right={<Text style={tw`text-gray-400`}>locked</Text>}
          />

          {/* First / Last name */}

          {/* Username (optional) */}
          {/* <Field
            label="Username (optional)"
            value={username}
            onChangeText={v => setUsername(v.replace(/\s+/g, '').toLowerCase())}
            autoCapitalize="none"
            placeholder="yourhandle"
            right={
              username ? (
                usernameTaken === null ? (
                  <Text style={tw`text-gray-400`}>checking…</Text>
                ) : usernameTaken ? (
                  <Text style={tw`text-red-400`}>taken</Text>
                ) : (
                  <Text style={tw`text-green-400`}>available</Text>
                )
              ) : undefined
            }
          /> */}

          {/* Submit */}
        </ScrollView>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={tw.style(
            `rounded-2xl py-3 items-center`,
            canSubmit && !submitting ? `bg-[#005ad0]` : `bg-[#1a2a3b]`,
          )}
        >
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <Text style={tw`text-white font-semibold`}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Reusable field */
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
  editable?: boolean;
  secureTextEntry?: boolean;
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
    editable = true,
    secureTextEntry,
  } = props;

  return (
    <View style={[tw`mb-4`, containerStyle]}>
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
        editable={editable}
        secureTextEntry={secureTextEntry}
        style={tw.style(
          `text-white rounded-xl px-3 py-3 border`,
          error ? `border-red-500` : `border-[#253041]`,
          !editable && `opacity-60`,
        )}
        multiline={multiline}
        maxLength={maxLength}
      />
      {!!error && <Text style={tw`text-red-400 mt-1`}>{error}</Text>}
    </View>
  );
}
