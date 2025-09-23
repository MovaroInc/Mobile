// src/screens/Auth/LegalAgreementsScreen.tsx
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import * as Feather from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TERMS_URL = 'https://yourdomain.com/terms';
const PRIVACY_URL = 'https://yourdomain.com/privacy';
const EULA_URL = 'https://yourdomain.com/eula';

type Item = {
  key: 'terms' | 'privacy' | 'eula';
  label: string;
  url: string;
};

const ITEMS: Item[] = [
  { key: 'terms', label: 'Terms of Service', url: TERMS_URL },
  { key: 'privacy', label: 'Privacy Policy', url: PRIVACY_URL },
  { key: 'eula', label: 'End User License Agreement (EULA)', url: EULA_URL },
];

const AcceptingLegalScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [accepted, setAccepted] = useState<Record<Item['key'], boolean>>({
    terms: false,
    privacy: false,
    eula: false,
  });

  useLayoutEffect(() => {
    const initialized = async () => {
      const storedLegalAccepted = await AsyncStorage.getItem('legalAccepted');
      setAccepted({
        ...accepted,
        terms: storedLegalAccepted === 'true',
        privacy: storedLegalAccepted === 'true',
        eula: storedLegalAccepted === 'true',
      });
    };
    initialized();
  }, []);

  const allAccepted = useMemo(
    () => accepted.terms && accepted.privacy && accepted.eula,
    [accepted],
  );

  const toggle = (key: Item['key']) =>
    setAccepted(prev => ({ ...prev, [key]: !prev[key] }));

  const setAll = (value: boolean) =>
    setAccepted({ terms: value, privacy: value, eula: value });

  const openLink = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Unable to open link', 'Please try again later.');
    } catch {
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  };

  const onContinue = async () => {
    if (!allAccepted) {
      Alert.alert(
        'Accept required documents',
        'Please accept the Terms of Service, Privacy Policy, and EULA to continue.',
      );
      return;
    }
    // proceed to next step
    await AsyncStorage.setItem('legalAccepted', 'true');
    navigation.navigate('CreatingProfile'); // adjust route as needed
  };

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View
      style={[
        tw`w-5 h-5 rounded-md items-center justify-center mr-3`,
        {
          borderWidth: 1,
          borderColor: checked ? colors.brand.primary : colors.border,
          backgroundColor: checked ? colors.brand.primary : 'transparent',
        },
      ]}
    >
      {checked ? (
        <Feather.Check stroke="#ffffff" width={14} height={14} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <View style={tw`flex-1 items-center justify-between`}>
        {/* Accent bar */}
        <View style={tw`w-full flex-1 items-center justify-start`}>
          <View
            style={[
              tw`w-1/3 h-2 mt-6 rounded-full`,
              { backgroundColor: colors.brand.primary },
            ]}
          />

          {/* Title */}
          {/* <Image source={Logo} style={tw`w-14 h-14 mt-8`} /> */}
          <View style={tw`mt-4`}>
            <Text style={[tw`text-2xl font-semibold`, { color: colors.text }]}>
              Signup
            </Text>
          </View>
          <View style={tw`w-11/12 mt-4`}>
            <Text style={[tw`text-xl`, { color: colors.text }]}>
              Business Details
            </Text>
            <Text style={[tw`mt-2 text-xs`, { color: colors.muted }]}>
              To finish creating your Movaro account, please review and accept
              the following documents.
            </Text>
          </View>

          {/* Card */}
          <View style={[tw`w-12/12 rounded-3 mt-4 p-4`]}>
            {ITEMS.map(item => (
              <View key={item.key} style={tw`mb-4`}>
                <View style={tw`flex-row items-center`}>
                  <TouchableOpacity
                    onPress={() => toggle(item.key)}
                    style={tw`flex-row items-center flex-1`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: accepted[item.key] }}
                  >
                    <Checkbox checked={accepted[item.key]} />
                    <Text style={[tw`text-base`, { color: colors.text }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openLink(item.url)}
                    hitSlop={8}
                  >
                    <Text style={tw`text-sm font-bold text-sky-600`}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Select all */}
            <TouchableOpacity
              onPress={() => setAll(!allAccepted)}
              style={tw`flex-row items-center mt-1`}
            >
              <Checkbox checked={allAccepted} />
              <Text style={[tw`text-sm`, { color: colors.text }]}>
                Accept all
              </Text>
            </TouchableOpacity>
            <View style={tw`w-full mt-6`}>
              <AuthBotton
                label="Complete Signup"
                loading={false}
                onPress={onContinue}
              />
            </View>
          </View>

          {/* Continue */}

          {/* Back */}
          <View style={tw`mt-4 flex-row items-center justify-center`}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={tw`ml-2`}
            >
              <Text style={tw`text-sm font-bold text-sky-600`}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={tw`w-11/12 mt-auto mb-6`}>
            <Text style={[tw`text-xs text-center`, { color: colors.muted }]}>
              You can change this anytime in Settings. Movaro uses location only
              for business operations while you’re on shift.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AcceptingLegalScreen;
