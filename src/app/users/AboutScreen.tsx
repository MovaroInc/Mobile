// src/app/profile/AboutScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { ArrowLeft, ExternalLink, Info } from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import Config from 'react-native-config';

// NOTE: keep this path consistent with your assets
import Logo from '../../shared/assets/m-icon-name-blue.png';

export default function AboutScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();

  const VERSION = Config.APP_VERSION || '1.0.0';
  const BUILD = Config.APP_BUILD || '';
  const versionLine = useMemo(
    () => (BUILD ? `${VERSION} (${BUILD})` : VERSION),
    [VERSION, BUILD],
  );

  const openUrl = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
    } catch {}
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
            About Movaro
          </Text>
        </View>

        {/* Brand / Hero */}
        <View style={tw`items-start mb-4`}>
          <Image source={Logo} style={tw`w-7/12 h-12`} resizeMode="contain" />
          <Text
            style={[
              tw`mt-2 text-base font-semibold`,
              { color: colors.brand?.primary || '#2563eb' },
            ]}
          >
            Smarter Routes. Simpler Logistics.
          </Text>
        </View>

        {/* Card: About */}
        <View
          style={[
            tw`rounded-2xl p-4 mb-4`,
            {
              backgroundColor: colors.main,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[tw`text-base`, { color: colors.text }]}>
            Movaro helps teams plan routes, coordinate drivers, and deliver with
            confidence. We care deeply about privacy and reliability so your
            operations stay smooth and secure.
          </Text>

          <Text style={[tw`mt-3 text-sm`, { color: colors.muted }]}>
            Version: {versionLine}
          </Text>
        </View>

        {/* Card: Links */}
        <View
          style={[
            tw`rounded-2xl mb-4`,
            {
              backgroundColor: colors.main,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <LinkRow
            label="Website"
            onPress={() => openUrl('https://www.movaroinc.com')}
            colors={colors}
          />
          <Divider colors={colors} />
        </View>

        {/* Card: Support */}
        <View
          style={[
            tw`rounded-2xl p-4`,
            {
              backgroundColor: colors.main,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={tw`flex-row items-center mb-2`}>
            <Info color={colors.text} width={16} height={16} />
            <Text style={[tw`ml-2 font-semibold`, { color: colors.text }]}>
              Need help?
            </Text>
          </View>
          <Text style={[tw`text-sm mb-3`, { color: colors.muted }]}>
            Questions or feedback? Our team is here to help.
          </Text>
          <TouchableOpacity
            onPress={() => nav.navigate('ContactSupport')}
            style={[
              tw`rounded-xl py-3 items-center`,
              { backgroundColor: colors.brand?.primary || '#2563eb' },
            ]}
          >
            <Text style={tw`text-white font-semibold`}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={[tw`mt-6 text-center text-xs`, { color: colors.muted }]}>
          © {new Date().getFullYear()} Movaro Inc. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ───────────── helpers ───────────── */

function LinkRow({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={tw`flex-row items-center justify-between px-4 py-3`}
    >
      <Text style={[tw`text-base`, { color: colors.text }]}>{label}</Text>
      <ExternalLink color={colors.muted} width={16} height={16} />
    </TouchableOpacity>
  );
}

function Divider({ colors }: { colors: any }) {
  return (
    <View
      style={[
        tw`h-[1px]`,
        { backgroundColor: colors.border, opacity: 0.8, marginHorizontal: 16 },
      ]}
    />
  );
}
