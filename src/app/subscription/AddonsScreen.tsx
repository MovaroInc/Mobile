// src/screens/subscription/AddonsScreen.tsx
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import tailwind from 'twrnc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import TempStandardButton from '../../shared/components/buttons/TempStandardButton';
import { useNavigation } from '@react-navigation/native';
import Stepper from '../../shared/components/inputs/Stepper';
import { ChevronsLeft } from 'react-native-feather';

type BillingCycle = 'monthly' | 'annual';

const AddonsScreen = () => {
  const { colors } = useTheme();
  const { setSignedOut } = useSession();
  const navigation = useNavigation();

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const [extraDrivers, setExtraDrivers] = useState<number>(0);
  const [extraStopsUnits, setExtraStopsUnits] = useState<number>(0); // 1 unit = 100 stops

  useLayoutEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    const raw = await AsyncStorage.getItem('selectedPlan');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    setSelectedPlan(parsed);
  };

  const DRIVER_ADDON_PRICE = 49.99;
  const STOPS_ADDON_PRICE_PER_100 = 11.99;

  const driversMonthlyTotal = extraDrivers * DRIVER_ADDON_PRICE;
  const stopsMonthlyTotal = extraStopsUnits * STOPS_ADDON_PRICE_PER_100;

  const yearly = (m: number) => Math.round(m * 12 * 0.8 * 100) / 100;

  const baseMonthlyPrice = useMemo(
    () => Number(selectedPlan?.monthly || 0),
    [selectedPlan],
  );

  const baseAnnualPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return Number(
      selectedPlan.annual ??
        Math.round(Number(selectedPlan.monthly || 0) * 12 * 0.8 * 100) / 100,
    );
  }, [selectedPlan]);

  const addonsMonthly = useMemo(() => {
    const drivers = extraDrivers * DRIVER_ADDON_PRICE;
    const stops = extraStopsUnits * STOPS_ADDON_PRICE_PER_100;
    return Math.round((drivers + stops) * 100) / 100;
  }, [extraDrivers, extraStopsUnits]);

  const addonsAnnual = useMemo(() => yearly(addonsMonthly), [addonsMonthly]);

  const totalMonthly = useMemo(
    () => Math.round((baseMonthlyPrice + addonsMonthly) * 100) / 100,
    [baseMonthlyPrice, addonsMonthly],
  );

  const totalAnnual = useMemo(
    () => Math.round((baseAnnualPrice + addonsAnnual) * 100) / 100,
    [baseAnnualPrice, addonsAnnual],
  );

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const nextStep = async () => {
    await AsyncStorage.setItem('addonStops', String(extraStopsUnits)); // units
    await AsyncStorage.setItem('extraDrivers', String(extraDrivers));
    // navigate onward
    navigation.navigate('Confirmation' as never);
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
              Add-ons
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSignedOut()}>
            <Text style={[tailwind`text-base`, { color: colors.accent }]}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[tailwind`text-base mt-2`, { color: colors.text }]}>
          Select your add-ons
        </Text>

        <View style={tailwind`flex-1`}>
          {/* Selected plan summary */}
          {selectedPlan && (
            <View
              style={[
                tailwind`w-full p-3 rounded-2 mt-4`,
                { backgroundColor: colors.borderSecondary },
              ]}
            >
              <View style={tailwind`flex-row justify-between items-start`}>
                <Text
                  style={[tailwind`text-lg font-bold`, { color: colors.text }]}
                >
                  {selectedPlan.name}
                </Text>

                <View style={tailwind`items-end`}>
                  <Text
                    style={[
                      tailwind`text-xl font-bold`,
                      { color: colors.brand.primary },
                    ]}
                  >
                    {billing === 'monthly'
                      ? fmt(baseMonthlyPrice)
                      : fmt(baseAnnualPrice)}
                  </Text>
                  <Text
                    style={[tailwind`text-xs mt--1`, { color: colors.text }]}
                  >
                    /{billing}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  tailwind`flex-row justify-between mt-2 pt-2`,
                  { borderTopWidth: 1, borderColor: colors.border },
                ]}
              >
                <Text style={[tailwind`text-xs`, { color: colors.text }]}>
                  {selectedPlan?.drivers?.min}–{selectedPlan?.drivers?.max}{' '}
                  drivers
                </Text>
                <Text style={[tailwind`text-xs`, { color: colors.text }]}>
                  {selectedPlan?.stopsPerMonth} stops / mo
                </Text>
              </View>

              <View style={tailwind`flex-row justify-between mt-1`}>
                <Text style={[tailwind`text-xs`, { color: colors.text }]}>
                  {selectedPlan?.stopsPerDriverPerDay?.min}–
                  {selectedPlan?.stopsPerDriverPerDay?.max} avg. stops/day
                </Text>
                <Text style={[tailwind`text-xs`, { color: colors.text }]}>
                  {fmt(selectedPlan?.perStop || 0)} per stop
                </Text>
              </View>
            </View>
          )}

          {/* Add-on steppers */}
          <View style={tailwind`mt-4`}>
            {selectedPlan?.id === 'enterprise-1' && (
              <Stepper
                label="Additional Drivers"
                value={extraDrivers}
                onChange={setExtraDrivers}
                step={1}
                min={0}
                toStops={false}
                rightText={fmt(driversMonthlyTotal)}
              />
            )}

            <Stepper
              label="Additional Stops"
              value={extraStopsUnits}
              onChange={setExtraStopsUnits}
              step={1} // 1 unit = 100 stops
              min={0}
              toStops
              rightText={fmt(stopsMonthlyTotal)}
            />
          </View>

          {/* (Optional) Summary preview here if you want */}
          {/* <View style={[tailwind`mt-4 p-3 rounded-2`, { backgroundColor: colors.borderSecondary }]}>
            <Row label="Base" value={billing === 'monthly' ? baseMonthlyPrice : baseAnnualPrice} colors={colors} />
            <Row label="Add-ons" value={billing === 'monthly' ? addonsMonthly : addonsAnnual} colors={colors} />
            <Row label="Total" value={billing === 'monthly' ? totalMonthly : totalAnnual} colors={colors} bold />
          </View> */}
        </View>

        {/* Sticky footer confirm */}
      </View>

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

export default AddonsScreen;
