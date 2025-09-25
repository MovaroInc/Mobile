import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import tailwind from 'twrnc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { plans } from '../../shared/utils/subscriptions';
import TempStandardButton from '../../shared/components/buttons/TempStandardButton';
import { useNavigation } from '@react-navigation/native';
import { ChevronsLeft } from 'react-native-feather';

type BillingCycle = 'monthly' | 'annual';

const ConfirmationScreen = () => {
  const { colors } = useTheme();
  const { setSignedOut } = useSession();
  const navigation = useNavigation();

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  // Add-ons state
  const [extraDrivers, setExtraDrivers] = useState<number>(0);
  // "units" of 100 stops (e.g., value 3 = 300 stops)
  const [extraStopsUnits, setExtraStopsUnits] = useState<number>(0);

  useLayoutEffect(() => {
    loadPlan();
    loadAddons();
  }, []);

  const loadPlan = async () => {
    const plan = await AsyncStorage.getItem('selectedPlan');
    console.log('plan', plan);
    setSelectedPlan(JSON.parse(plan || '{}')); // could also include tier info if desired
  };

  const loadAddons = async () => {
    const storedExtraStops = await AsyncStorage.getItem('addonStops');
    const storedExtraDrivers = await AsyncStorage.getItem('extraDrivers');
    setExtraStopsUnits(Number(storedExtraStops || 0));
    setExtraDrivers(Number(storedExtraDrivers || 0));
  };

  // ----------------------------
  // Configurable pricing helpers
  // ----------------------------
  // If you want to tier-price add-ons, switch these to per-tier maps keyed by selectedPlan.id prefix.
  // For now: flat pricing (easy to adjust later)
  const DRIVER_ADDON_PRICE = 49.99; // per additional driver / mo
  const STOPS_ADDON_PRICE_PER_100 = 11.99; // per extra 100 stops / mo

  // Annual = 12 months * 0.8 (20% off overall)
  const yearly = (m: number) => Math.round(m * 12 * 0.8 * 100) / 100;

  const baseMonthlyPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return Number(selectedPlan.monthly || 0);
  }, [selectedPlan]);

  const baseAnnualPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    // If your plan already includes a precomputed .annual, prefer it; else compute
    return Number(
      selectedPlan.annual ??
        Math.round(Number(selectedPlan.monthly || 0) * 12 * 0.8 * 100) / 100,
    );
  }, [selectedPlan]);

  // Add-on subtotals
  const addonsMonthly = useMemo(() => {
    const drivers = extraDrivers * DRIVER_ADDON_PRICE;
    const stops = extraStopsUnits * STOPS_ADDON_PRICE_PER_100;
    return Math.round((drivers + stops) * 100) / 100;
  }, [extraDrivers, extraStopsUnits]);

  const addonsAnnual = useMemo(() => yearly(addonsMonthly), [addonsMonthly]);

  // Totals
  const totalMonthly = useMemo(
    () => Math.round((baseMonthlyPrice + addonsMonthly) * 100) / 100,
    [baseMonthlyPrice, addonsMonthly],
  );
  const totalAnnual = useMemo(
    () => Math.round((baseAnnualPrice + addonsAnnual) * 100) / 100,
    [baseAnnualPrice, addonsAnnual],
  );

  // ----------------------------
  // UI helpers
  // ----------------------------
  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const nextStep = async () => {
    navigation.navigate('BillingSetup');
  };

  return (
    <View style={tailwind`flex-1`}>
      <View style={tailwind`px-4 pb-24 flex flex-col flex-1`}>
        {/* Header */}
        <View
          style={tailwind`w-full flex-row items-center justify-between mt-4`}
        >
          <View style={tailwind`flex-row items-center`}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronsLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text
              style={[
                tailwind`text-2xl font-semibold ml-2`,
                { color: colors.text },
              ]}
            >
              Confirmation
            </Text>
          </View>

          <TouchableOpacity onPress={() => setSignedOut()}>
            <Text style={[tailwind`text-base`, { color: colors.accent }]}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[tailwind`text-base mt-2`, { color: colors.text }]}>
          Review & Confirm your order
        </Text>

        <View
          style={[
            tailwind`mt-3 p-4 rounded-2`,
            { backgroundColor: colors.borderSecondary },
          ]}
        >
          <Text
            style={[
              tailwind`text-lg font-semibold mb-2`,
              { color: colors.text },
            ]}
          >
            Selected Plans
          </Text>

          {/* <Row
            label={`Base (${billing})`}
            value={billing === 'monthly' ? baseMonthlyPrice : baseAnnualPrice}
            colors={colors}
          /> */}
          <View>
            <View style={tailwind`flex-row justify-between items-center mb-1`}>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Base ({selectedPlan?.tier}
                {selectedPlan?.name})
              </Text>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                {fmt(
                  billing === 'monthly' ? baseMonthlyPrice : baseAnnualPrice,
                )}
              </Text>
            </View>
            <View style={tailwind`flex-row justify-start items-center px-3`}>
              <Text style={[tailwind`text-sm`, { color: colors.text }]}>
                {selectedPlan?.drivers?.min}–{selectedPlan?.drivers?.max}{' '}
                drivers
              </Text>
              <Text style={[tailwind`text-sm ml-4`, { color: colors.text }]}>
                {selectedPlan?.stopsPerMonth} stops / mo
              </Text>
            </View>
          </View>
          <View
            style={[
              tailwind`my-4`,
              { borderTopWidth: 1, borderColor: colors.border },
            ]}
          />
          <View style={[tailwind`w-full`]}>
            <Text
              style={[
                tailwind`text-lg font-semibold mb-2`,
                { color: colors.text },
              ]}
            >
              Add-ons
            </Text>
            <Row
              label="Additional Drivers (x1)"
              value={extraDrivers}
              colors={colors}
            />
            <Row
              label="Additional Stops (x100)"
              value={extraStopsUnits}
              colors={colors}
            />
          </View>

          <View
            style={[
              tailwind`my-2`,
              { borderTopWidth: 1, borderColor: colors.border },
            ]}
          />

          <View style={tailwind`w-full`}>
            <View style={tailwind`flex-row justify-between items-center mb-1`}>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Total due
              </Text>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                {fmt(totalMonthly)}
              </Text>
            </View>
          </View>

          <Text style={[tailwind`text-xs mt-3`, { color: colors.text }]}>
            By tapping Continue, you agree to the Terms of Service.
          </Text>
        </View>
      </View>

      {/* Sticky footer confirm */}
      <View
        style={[
          tailwind`absolute left-0 right-0 bottom-0 p-4`,
          { backgroundColor: colors.bg },
        ]}
      >
        <TempStandardButton
          label="Continue"
          loading={false}
          active={true}
          onPress={nextStep}
        />
      </View>
    </View>
  );
};

function Row({
  label,
  value,
  colors,
  bold,
}: {
  label: string;
  value: number;
  colors: any;
  bold?: boolean;
}) {
  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  return (
    <View style={tailwind`w-full`}>
      <View style={tailwind`flex-row justify-between items-center mb-1`}>
        <Text
          style={[
            tailwind`${bold ? 'text-base font-semibold' : 'text-sm'}`,
            { color: colors.text },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            tailwind`${bold ? 'text-base font-semibold' : 'text-sm'}`,
            { color: colors.text },
          ]}
        >
          {fmt(value * (label === 'Additional Drivers (x1)' ? 49.99 : 11.99))}
        </Text>
      </View>
      {value > 0 && (
        <View style={tailwind`flex-row justify-between items-center mb-1 px-3`}>
          <Text
            style={[
              tailwind`${bold ? 'text-base font-semibold' : 'text-sm'}`,
              { color: colors.text },
            ]}
          >
            {value} drivers
          </Text>
        </View>
      )}
    </View>
  );
}

export default ConfirmationScreen;
