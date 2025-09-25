// src/screens/subscription/BillingSetupScreen.tsx
import React, { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import tailwind from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  useSession,
  useProfile,
  useBusiness,
  useUserId,
} from '../../state/useSession';
import { api } from '../../shared/lib/api';
import TempStandardButton from '../../shared/components/buttons/TempStandardButton';
import { useNavigation } from '@react-navigation/native';
import { useStripe } from '@stripe/stripe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UpsertCustomerResponse = {
  success: boolean;
  customerId?: string;
  message?: string | null;
  data?: { customerId?: string };
};

type StripeSheetResponse = {
  success: boolean;
  data?: {
    customerId: string;
    hasDefault: boolean;
    defaultPaymentMethod?: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
    ephemeralKey?: string;
    setupIntentClientSecret?: string;
    businessName?: string | null;
    merchantCountryCode?: string;
  };
  message?: string;
};

// NEW: response shape from /billing/create-subscription
type CreateSubResponse = {
  success: boolean;
  message?: string | null;
  data?: {
    businessId: number;
    stripeSubscriptionId: string;
    status: string; // 'active' | 'trialing' | etc.
    currentPeriodEnd?: string | null;
    latestInvoiceId?: string | null;
  };
};

export default function BillingSetupScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  // NEW: pull fetchMe so we can refresh after sub is stored
  const { setSignedOut, refreshMe } = useSession();

  const profile = useProfile();
  const business = useBusiness();
  const userId = useUserId();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Customer section (existing)
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payment method section (NEW)
  const [pmChecking, setPmChecking] = useState(false);
  const [pmHasDefault, setPmHasDefault] = useState<boolean | null>(null);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmBusy, setPmBusy] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [billing, setBilling] = useState<string>('monthly');

  // Add-ons state
  const [extraDrivers, setExtraDrivers] = useState<number>(0);
  const [extraStopsUnits, setExtraStopsUnits] = useState<number>(0);

  const [pmDetails, setPmDetails] = useState<
    StripeSheetResponse['data']['defaultPaymentMethod'] | null
  >(null);

  const displayName = useMemo(() => {
    const n =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      business?.name ||
      profile?.email ||
      'Your account';
    return n;
  }, [profile, business]);

  // Step 1: ensure customer
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<UpsertCustomerResponse>(
          '/billing/upsert-customer',
          { userId },
        );
        const cid = res?.data?.data?.customerId || res?.data?.customerId;
        if (!res?.data?.success || !cid) {
          setError(
            res?.data?.message || 'Failed to create or fetch Stripe customer.',
          );
          setCustomerId(null);
        } else {
          setCustomerId(cid);
        }
      } catch (e: any) {
        setError(e?.message || 'Unexpected error.');
        setCustomerId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Step 2: check PM and, if needed, trigger PaymentSheet
  const checkOrCollectPaymentMethod = async (autoPresent = true) => {
    if (!userId || !customerId) return;

    setPmChecking(true);
    setPmError(null);

    try {
      const res = await api.post<StripeSheetResponse>('/billing/stripe-sheet', {
        userId,
        customerId,
      });
      if (!res?.data?.success || !res?.data?.data?.customerId) {
        throw new Error(
          res?.data?.message || 'Failed to check payment method.',
        );
      }

      const d = res.data.data;
      if (d.hasDefault) {
        setPmHasDefault(true);
        setPmDetails(d.defaultPaymentMethod ?? null);
        return;
      }

      setPmHasDefault(false);
      setPmDetails(null);

      if (!d.ephemeralKey || !d.setupIntentClientSecret) {
        throw new Error('Missing PaymentSheet credentials from server.');
      }

      const init = await initPaymentSheet({
        customerId: d.customerId,
        customerEphemeralKeySecret: d.ephemeralKey,
        setupIntentClientSecret: d.setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        merchantDisplayName: d.businessName || displayName || 'Your business',
        defaultBillingDetails: {
          name:
            business?.name ||
            [profile?.first_name, profile?.last_name]
              .filter(Boolean)
              .join(' ') ||
            undefined,
          email: profile?.email || undefined,
          phone: profile?.phone || undefined,
        },
      });

      if (init.error) {
        throw new Error(init.error.message || 'PaymentSheet init failed');
      }

      if (!autoPresent) return;

      setPmBusy(true);
      const present = await presentPaymentSheet();
      setPmBusy(false);

      if (present.error) {
        if (present.error.code !== 'Canceled') {
          throw new Error(
            present.error.message || 'Failed to add payment method',
          );
        }
        return;
      }

      // Ensure default on server
      await api.post('/billing/ensure-default-payment-method', {
        userId,
        customerId,
      });

      // Re-check status:
      setPmChecking(true);
      const res2 = await api.post<StripeSheetResponse>(
        '/billing/stripe-sheet',
        { userId, customerId },
      );
      const hasDef = !!res2?.data?.data?.hasDefault;
      setPmHasDefault(hasDef);
      setPmDetails(res2?.data?.data?.defaultPaymentMethod ?? null);
    } catch (e: any) {
      setPmError(e?.message || 'Payment method setup failed.');
    } finally {
      setPmChecking(false);
      setPmBusy(false);
    }
  };

  useLayoutEffect(() => {
    loadPlan();
    loadAddons();
  }, []);

  const loadPlan = async () => {
    const plan = await AsyncStorage.getItem('selectedPlan');
    const term = await AsyncStorage.getItem('selectedTerm');
    setSelectedPlan(JSON.parse(plan || '{}'));
    setBilling(term || 'monthly');
  };

  const loadAddons = async () => {
    const storedExtraStops = await AsyncStorage.getItem('addonStops');
    const storedExtraDrivers = await AsyncStorage.getItem('extraDrivers');
    setExtraStopsUnits(Number(storedExtraStops || 0));
    setExtraDrivers(Number(storedExtraDrivers || 0));
  };

  // Pricing helpers
  const DRIVER_ADDON_PRICE = 49.99; // /mo
  const STOPS_ADDON_PRICE_PER_100 = 11.99; // /mo per 100 stops
  const yearly = (m: number) => Math.round(m * 12 * 0.8 * 100) / 100;

  const baseMonthlyPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return Number(selectedPlan.monthly || 0);
  }, [selectedPlan]);

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

  // Auto-run once customerId is ready
  useEffect(() => {
    if (!customerId) return;
    checkOrCollectPaymentMethod(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // ---------- NEW: create subscription ----------
  const couponForTerm = (term: string) =>
    term === 'monthly' ? 'into-promo-1-month' : 'intro-promo-3-months';

  const onContinue = async () => {
    setLoading(true);
    try {
      if (!customerId) return;
      if (pmHasDefault !== true) {
        Alert.alert('Add payment method', 'Please add a default card first.');
        return;
      }

      // Build plan item
      const planPayload = {
        tier: `${selectedPlan?.tier || ''}${
          selectedPlan?.name ? ` ${selectedPlan.name}` : ''
        }`.trim(),
        billing: billing, // 'monthly' | 'annual'
        productName: selectedPlan?.name || 'Subscription',
        baseUnitAmountCents: Math.round(
          (billing === 'monthly' ? baseMonthlyPrice : baseAnnualPrice) * 100,
        ),
        driverCount: Number(selectedPlan?.drivers?.max + extraDrivers || 0),
        stopCount: Number(
          selectedPlan?.stopsPerMonth + extraStopsUnits * 100 || 0,
        ),
      };

      // Add-ons as line items (convert to term price)
      const priceForTerm = (perMonth: number) =>
        billing === 'monthly' ? perMonth : perMonth * 12;

      const addonsPayload = [
        {
          key: 'extra_driver',
          productName: 'Additional Driver (x1)',
          unitAmountCents: Math.round(priceForTerm(49.99) * 100),
          quantity: Number(extraDrivers || 0),
        },
        {
          key: 'extra_stops_100',
          productName: 'Additional Stops (x100)',
          unitAmountCents: Math.round(priceForTerm(11.99) * 100),
          quantity: Number(extraStopsUnits || 0),
        },
      ];

      const payload = {
        userId,
        businessId: business?.id,
        customerId,
        plan: planPayload,
        addons: addonsPayload,
        couponCode: couponForTerm(billing),
      };

      console.log('payload', JSON.stringify(payload, null, 2));

      const res = await api.post<CreateSubResponse>(
        '/billing/create-subscription',
        payload,
      );

      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Subscription failed.');
      }

      // Refresh session and jump to app
      await refreshMe();
      setLoading(false);
      // Replace stack to your main tab/root screen name
      // @ts-ignore
    } catch (e: any) {
      Alert.alert(
        'Subscription error',
        e?.message || 'Something went wrong while starting your subscription.',
      );
    }
  };
  // ------------------------------------------------

  return (
    <View style={tailwind`flex-1`}>
      <View style={tailwind`px-4 pt-6 pb-28 flex-1`}>
        {/* Header */}
        <View style={tailwind`w-full flex-row items-center justify-between`}>
          <Text
            style={[tailwind`text-2xl font-semibold`, { color: colors.text }]}
          >
            Billing setup
          </Text>
          <TouchableOpacity onPress={() => setSignedOut()}>
            <Text style={[tailwind`text-base`, { color: colors.accent }]}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[tailwind`text-base mt-2`, { color: colors.text }]}>
          We’ll set up billing for{' '}
          <Text style={{ fontWeight: '600' }}>{displayName}</Text>.
        </Text>

        <View
          style={[
            tailwind`mt-3 p-4 rounded-2`,
            { backgroundColor: colors.borderSecondary },
          ]}
        >
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
            <Row
              label="Additional Drivers (x1)"
              value={extraDrivers}
              colors={colors}
              billing={billing}
            />
            <Row
              label="Additional Stops (x100)"
              value={extraStopsUnits}
              colors={colors}
              billing={billing}
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
                Monthly Balance
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
            <View style={tailwind`flex-row justify-between items-center mb-1`}>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                Promo (
                {billing === 'monthly' ? '1 month free' : '3 months free'})
              </Text>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                {billing === 'monthly'
                  ? `-${fmt(totalMonthly)}`
                  : `-${fmt(totalAnnual * 0.25)}`}
              </Text>
            </View>
            <View style={tailwind`flex-row justify-between items-center mb-1`}>
              <Text
                style={[
                  tailwind`text-lg font-semibold`,
                  { color: colors.text },
                ]}
              >
                Due Today
              </Text>
              <Text
                style={[
                  tailwind`text-base font-semibold`,
                  { color: colors.text },
                ]}
              >
                {billing === 'monthly' ? `$0.00` : `${fmt(totalAnnual * 0.25)}`}
              </Text>
            </View>
          </View>

          {billing === 'monthly' ? (
            <Text style={[tailwind`text-xs mt-3`, { color: colors.text }]}>
              You will be charged $0.00 today. After the 30 day trial, you will
              be charged {fmt(totalMonthly)}. You will be able to cancel at any
              time by contacting support.
            </Text>
          ) : (
            <Text style={[tailwind`text-xs mt-3`, { color: colors.text }]}>
              You will be charged {fmt(totalAnnual * 0.25)} today. After 1 year,
              you will be charged {fmt(totalAnnual)} every year after. You will
              be able to cancel at any time by contacting support.
            </Text>
          )}

          <Text style={[tailwind`text-xs mt-3`, { color: colors.text }]}>
            By tapping Continue, you agree to the Terms of Service.
          </Text>
        </View>

        {/* Payment Method section */}
        <View
          style={[
            tailwind`mt-4 p-4 rounded-2`,
            { backgroundColor: colors.borderSecondary },
          ]}
        >
          <Text
            style={[tailwind`text-lg font-semibold`, { color: colors.text }]}
          >
            Payment Method
          </Text>

          {pmChecking ? (
            <View style={tailwind`mt-3 flex-row items-center`}>
              <ActivityIndicator />
              <Text style={[tailwind`ml-3`, { color: colors.text }]}>
                Checking…
              </Text>
            </View>
          ) : pmError ? (
            <>
              <Text style={[tailwind`mt-3`, { color: colors.accent }]}>
                {pmError}
              </Text>
              <TouchableOpacity
                onPress={() => checkOrCollectPaymentMethod(false)}
                style={tailwind`mt-3 px-3 py-2 rounded bg-sky-600 self-start`}
              >
                <Text style={tailwind`text-white font-semibold`}>
                  Try again
                </Text>
              </TouchableOpacity>
            </>
          ) : pmHasDefault === true ? (
            pmDetails ? (
              <View style={tailwind`mt-2`}>
                <Text style={[tailwind`text-sm`, { color: colors.text }]}>
                  {pmDetails.brand?.toUpperCase?.() || 'CARD'} ••••{' '}
                  {pmDetails.last4}
                </Text>
                <Text style={[tailwind`text-sm`, { color: colors.text }]}>
                  Expires {String(pmDetails.exp_month).padStart(2, '0')}/
                  {String(pmDetails.exp_year).slice(-2)}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  tailwind`mt-2 text-sm font-semibold`,
                  { color: colors.text },
                ]}
              >
                Default card on file ✔
              </Text>
            )
          ) : pmHasDefault === false ? (
            <>
              <Text style={[tailwind`mt-2 text-sm`, { color: colors.text }]}>
                No card on file yet.
              </Text>
              <TouchableOpacity
                onPress={() => checkOrCollectPaymentMethod(true)}
                disabled={pmBusy}
                style={tailwind.style(
                  `mt-3 px-3 py-2 rounded self-start`,
                  pmBusy ? 'bg-sky-300' : 'bg-sky-600',
                )}
              >
                {pmBusy ? (
                  <View style={tailwind`flex-row items-center`}>
                    <ActivityIndicator color="white" />
                    <Text style={tailwind`ml-2 text-white font-semibold`}>
                      Opening…
                    </Text>
                  </View>
                ) : (
                  <Text style={tailwind`text-white font-semibold`}>
                    Add card
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[tailwind`mt-2 text-sm`, { color: colors.text }]}>
              Waiting for customer…
            </Text>
          )}
        </View>
      </View>

      {/* Sticky footer */}
      <View
        style={[
          tailwind`absolute left-0 right-0 bottom-0 p-4`,
          { backgroundColor: colors.bg },
        ]}
      >
        <TempStandardButton
          label="Continue"
          loading={loading || pmChecking || pmBusy}
          active={
            !!customerId &&
            pmHasDefault === true &&
            !loading &&
            !pmChecking &&
            !pmBusy
          }
          onPress={onContinue} // ← now creates the subscription
        />
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
  bold,
  billing,
}: {
  label: string;
  value: number;
  colors: any;
  bold?: boolean;
  billing: string;
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
          {billing === 'monthly'
            ? fmt(value * (label === 'Additional Drivers (x1)' ? 49.99 : 11.99))
            : fmt(
                value *
                  (label === 'Additional Drivers (x1)' ? 49.99 : 11.99) *
                  12,
              )}
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
            {label === 'Additional Drivers (x1)'
              ? `${value} drivers`
              : `${value} x 100 stops`}
          </Text>
        </View>
      )}
    </View>
  );
}
