// src/app/profile/ContactSupportScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { ArrowLeft } from 'react-native-feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import { api } from '../../shared/lib/api';
import { useSession } from '../../state/useSession';

type RouteParams = {
  subject?: string;
  prefill?: string;
};

export default function ContactSupportScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { profile, business, subscription } = useSession();

  // Optional prefill via route params
  const initialSubject = (route.params as RouteParams)?.subject || '';
  const initialMsg = (route.params as RouteParams)?.prefill || '';

  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMsg);
  const [sending, setSending] = useState(false);

  const canSend = useMemo(
    () => subject.trim().length > 2 && message.trim().length > 5 && !sending,
    [subject, message, sending],
  );

  const buildContext = () => ({
    platform: Platform.OS,
    version: Platform.Version,
    userId: profile?.id || null,
    username: profile?.username || null,
    email: profile?.email || null,
    businessId: business?.id || null,
    businessName: business?.name || null,
    subStatus: subscription?.status || null,
    subTier: subscription?.tier || null,
  });

  const fallbackMailTo = async () => {
    const to = 'support@movaroinc.com';
    const body =
      `${message}\n\n---\nContext\n` + JSON.stringify(buildContext(), null, 2);
    const url =
      `mailto:${to}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) return Linking.openURL(url);
    Alert.alert('Could not open email', 'Please email support@movaroinc.com');
  };

  const handleSend = async () => {
    if (!canSend) {
      Alert.alert('Check fields', 'Please fill in subject and message.');
      return;
    }
    Keyboard.dismiss();
    setSending(true);
    try {
      // Hit your backend — adjust path if different
      const payload = {
        subject: subject.trim(),
        message: message.trim(),
        context: buildContext(),
      };

      const resp = await api.post<{
        success: boolean;
        message?: string | null;
      }>('/support/contact', payload);

      if (!resp?.success) {
        // graceful fallback to mailto
        await fallbackMailTo();
        return;
      }

      Alert.alert('Sent', resp.message || 'Your message has been sent.');
      setSubject('');
      setMessage('');
      nav.goBack();
    } catch {
      // fallback to mail if API is unreachable
      await fallbackMailTo();
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={tw`px-4 pb-8`}>
        {/* Header */}
        <View style={tw`flex-row items-center mt-2 mb-4`}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <ArrowLeft color={colors.text} width={22} height={22} />
          </TouchableOpacity>
          <Text style={[tw`text-2xl font-bold ml-3`, { color: colors.text }]}>
            Contact Support
          </Text>
        </View>

        <Text style={[tw`mb-4`, { color: colors.muted }]}>
          Let us know how we can help you.
        </Text>

        {/* Subject */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>Subject</Text>
        <TextInput
          placeholder="Brief summary"
          value={subject}
          onChangeText={setSubject}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          placeholderTextColor="#9CA3AF"
          style={[
            tw`rounded-2xl px-3 py-3 mb-4`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {/* Message */}
        <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>Message</Text>
        <TextInput
          placeholder="Describe the issue or question…"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          placeholderTextColor="#9CA3AF"
          style={[
            tw`rounded-2xl px-3 py-3 mb-4`,
            {
              backgroundColor: colors.main,
              color: colors.text,
              minHeight: 160,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        {/* CTA */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={[
            tw`rounded-2xl py-3 items-center`,
            {
              backgroundColor: canSend
                ? colors.brand?.primary || '#2563eb'
                : colors.border,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-semibold`}>Send Message</Text>
          )}
        </TouchableOpacity>

        {/* Tiny privacy note */}
        <Text style={[tw`mt-4 text-center text-xs`, { color: colors.muted }]}>
          We include basic, non-sensitive app context to help resolve issues
          faster.
        </Text>
      </ScrollView>
    </View>
  );
}
