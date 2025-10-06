// src/app/profile/ProfileScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import {
  LogOut,
  Edit2,
  Lock,
  Info,
  Shield,
  FileText,
  MessageSquare,
  Truck,
  CreditCard,
  Menu,
  DollarSign,
  Repeat,
} from 'react-native-feather';

import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';
import { supabase } from '../../shared/lib/supabase';

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { profile, business, subscription } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const isBusinessOwner = useMemo(
    () => profile?.role === 'owner' || profile?.role === 'founder',
    [profile?.role],
  );

  const displayName = useMemo(() => {
    const n = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return n || profile?.username || 'User';
  }, [profile]);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
  }, [displayName]);

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open link.');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      // Still clear local session if your provider listens to auth state
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAccount },
      ],
    );
  };

  // Adjust this to your real backend route if different
  const deleteAccount = async () => {
    try {
      const res = await api.delete<{
        success: boolean;
        message?: string | null;
        error?: any | null;
      }>('/users/me');
      if (!res?.success) throw new Error(res?.message || 'Delete failed');
      Alert.alert('Deleted', 'Your account was removed.');
      await supabase.auth.signOut();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not delete account.');
    }
  };

  const handleSubmitSubscriptionRequest = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        to: 'contact@movaroinc.com',
        name: displayName,
        businessName: business?.name,
        businessId: business?.id,
        stripeCustomerId: subscription?.stripe_customer_id,
        stripeSubscriptionId: subscription?.stripe_subscription_id,
        status: subscription?.status,
        currentTier: subscription?.tier,
        requestedTier: 'custom',
        username: profile?.username,
        contactEmail: profile?.email,
        contactPhone: profile?.phone || 'no phone',
        notes: 'no notes',
        userId: profile?.id,
      };
      const r = await api.post<{
        success: boolean;
        error?: any;
        message?: string;
      }>('/notifications/send-update-subscription', payload);

      if (!r?.success) throw new Error(r?.message || 'Request failed');
      Alert.alert('Request sent', 'We’ll contact you shortly.');
    } catch (e: any) {
      Alert.alert('Could not send request', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`items-center mt-4 mb-6`}>
        <View
          style={[
            tw`rounded-full w-16 h-16 items-center justify-center`,
            { backgroundColor: colors.brand?.primary || '#2563eb' },
          ]}
        >
          <Text style={tw`text-white text-2xl font-bold`}>{initials}</Text>
        </View>
        <Text style={[tw`text-xl font-bold mt-2`, { color: colors.text }]}>
          {displayName}
        </Text>
        {!!profile?.email && (
          <Text style={[tw`mt-0.5`, { color: colors.muted }]}>
            {profile.email}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-20`}>
        {/* Profile actions */}
        <Card colors={colors}>
          <Row
            label="Edit Profile Info"
            Icon={Edit2}
            colors={colors}
            onPress={() => nav.navigate('UpdateProfile')}
          />
          <Divider colors={colors} />

          <Row
            label="Change Password"
            Icon={Lock}
            colors={colors}
            onPress={() => nav.navigate('ChangePassword')}
          />

          {isBusinessOwner && (
            <>
              <Divider colors={colors} />
              <Row
                label="Edit Business Info"
                Icon={Truck}
                colors={colors}
                onPress={() => nav.navigate('EditBusinessInfo')}
              />
            </>
          )}
        </Card>

        {/* Subscription (owners/founders) */}
        {isBusinessOwner && (
          <Card colors={colors} style={tw`mt-4`}>
            <SectionTitle colors={colors} label="Subscription" Icon={Repeat} />

            <Row
              label="Upgrade Subscription"
              Icon={CreditCard}
              colors={colors}
              onPress={handleSubmitSubscriptionRequest}
              inset
              trailingText={submitting ? 'Sending…' : undefined}
            />
            <Divider colors={colors} inset />

            <Row
              label="Manage Subscription"
              Icon={Menu}
              colors={colors}
              onPress={() => nav.navigate('ManageSubscription')}
              inset
            />
            <Divider colors={colors} inset />

            <Row
              label="Billing History"
              Icon={DollarSign}
              colors={colors}
              onPress={() => nav.navigate('BillingHistory')}
              inset
            />
          </Card>
        )}

        {/* Legal & Support */}
        <Card colors={colors} style={tw`mt-4`}>
          <Row
            label="Terms of Service"
            Icon={FileText}
            colors={colors}
            onPress={() =>
              openUrl(
                'https://app.termly.io/policy-viewer/policy.html?policyUUID=76b8e8ef-e955-456f-9c2a-8f26fcf585c5',
              )
            }
          />
          <Divider colors={colors} />
          <Row
            label="Privacy Policy"
            Icon={Shield}
            colors={colors}
            onPress={() =>
              openUrl(
                'https://app.termly.io/policy-viewer/policy.html?policyUUID=eeeea11f-53f0-488d-b083-74d7ac6ca6f3',
              )
            }
          />
          <Divider colors={colors} />
          <Row
            label="End User License Agreement (EULA)"
            Icon={FileText}
            colors={colors}
            onPress={() =>
              openUrl(
                'https://app.termly.io/policy-viewer/policy.html?policyUUID=4c1a37d3-df06-40ac-aa74-5943525cd87f',
              )
            }
          />
          <Divider colors={colors} />
          <Row
            label="Contact Support"
            Icon={MessageSquare}
            colors={colors}
            onPress={() => nav.navigate('ContactSupport')}
          />
          <Divider colors={colors} />
          <Row
            label="About"
            Icon={Info}
            colors={colors}
            onPress={() => nav.navigate('About')}
          />
        </Card>

        {/* Danger/Sign out */}
        <View style={tw`mt-6`}>
          <TouchableOpacity
            onPress={handleLogout}
            style={[
              tw`flex-row items-center justify-center rounded-lg py-3`,
              { backgroundColor: '#ef4444' },
            ]}
          >
            <LogOut color="#fff" width={20} height={20} />
            <Text style={tw`text-white font-bold ml-2`}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmDeleteAccount}
            style={tw`items-center mt-4 py-2`}
          >
            <Text style={[tw`font-bold`, { color: '#ef4444' }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────────────── helpers ───────────────── */

function Card({
  children,
  style,
  colors,
}: React.PropsWithChildren<{ style?: any; colors: any }>) {
  return (
    <View
      style={[
        tw`rounded-2xl`,
        {
          backgroundColor: colors.main,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Row({
  label,
  Icon,
  onPress,
  colors,
  inset = false,
  trailingText,
}: {
  label: string;
  Icon: any;
  onPress: () => void;
  colors: any;
  inset?: boolean;
  trailingText?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tw`flex-row items-center justify-between px-4 py-3`,
        inset && tw`pl-10`,
      ]}
    >
      <View style={tw`flex-row items-center`}>
        {!inset && <Icon color={colors.text} width={18} height={18} />}
        <Text
          style={[tw`${inset ? '' : 'ml-3'} text-base`, { color: colors.text }]}
        >
          {label}
        </Text>
      </View>
      {trailingText ? (
        <Text style={[tw`text-xs`, { color: colors.muted }]}>
          {trailingText}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Divider({ colors, inset = false }: { colors: any; inset?: boolean }) {
  return (
    <View
      style={[
        tw`h-[1px]`,
        { backgroundColor: colors.border, opacity: 0.8 },
        inset && tw`ml-10`,
      ]}
    />
  );
}

function SectionTitle({
  label,
  Icon,
  colors,
}: {
  label: string;
  Icon: any;
  colors: any;
}) {
  return (
    <View style={tw`flex-row items-center px-4 py-3`}>
      <Icon color={colors.text} width={18} height={18} />
      <Text style={[tw`ml-3 font-semibold`, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}
