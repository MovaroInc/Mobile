// src/app/subscription/SubscriptionScreen.tsx
import React from 'react';
import { Text, TouchableOpacity, View, Linking } from 'react-native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import tailwind from 'twrnc';

const SubscriptionScreen = () => {
  const { colors } = useTheme();
  const { setSignedOut, subscription } = useSession();

  const handleOpenMovaroSite = () => {
    // Use your live web domain / billing portal URL here
    Linking.openURL('https://www.movaroinc.com');
    // e.g. Linking.openURL('https://www.movaroinc.com/billing');
  };

  return (
    <View style={tailwind`flex-1 items-center justify-between p-4`}>
      <View style={tailwind`w-full flex-1`}>
        {/* Header */}
        <View
          style={tailwind`w-full flex-row items-center justify-between mb-4`}
        >
          <Text
            style={[tailwind`text-2xl font-semibold`, { color: colors.text }]}
          >
            Subscription required
          </Text>

          <TouchableOpacity onPress={setSignedOut}>
            <Text style={[tailwind`text-base`, { color: colors.accent }]}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info copy */}
        <View style={tailwind`w-11/12 mt-2`}>
          <Text style={[tailwind`text-base`, { color: colors.text }]}>
            This Movaro account doesn&apos;t currently have an active
            subscription.
          </Text>

          <Text
            style={[tailwind`text-sm mt-3 leading-5`, { color: colors.text }]}
          >
            Subscriptions for Movaro are managed on our website. To start or
            update a subscription for your business, open Movaro in your
            browser. Once your subscription is active or trialing, return to the
            app and sign in again.
          </Text>

          {subscription?.status && (
            <Text style={[tailwind`text-xs mt-3`, { color: colors.text }]}>
              Current status: {subscription.status}
            </Text>
          )}
        </View>

        {/* Button to open website */}
        <View style={tailwind`w-11/12 mt-6`}>
          <TouchableOpacity
            style={[
              tailwind`py-3 rounded-2xl items-center`,
              { backgroundColor: colors.brand.primary },
            ]}
            onPress={handleOpenMovaroSite}
          >
            <Text
              style={[tailwind`text-base font-semibold`, { color: 'white' }]}
            >
              Open Movaro website
            </Text>
          </TouchableOpacity>
        </View>

        {/* Small disclaimer for reviewer clarity */}
        <View style={tailwind`w-11/12 mt-4`}>
          <Text style={[tailwind`text-xs`, { color: colors.text }]}>
            Note: Account creation and subscription purchase are completed on
            the Movaro website, outside of this iOS app.
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SubscriptionScreen;
