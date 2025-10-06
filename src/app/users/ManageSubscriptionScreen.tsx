// src/app/subscription/ManageSubscriptionScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { ChevronLeft } from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';
import {
  initPaymentSheet,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';

/* ───────────────── types ───────────────── */
type PM = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  isDefault: boolean;
};

type InvoiceOpen = {
  id: string;
  amount_due_cents: number;
  created_at: string | null;
  status: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
};

type SubscriptionSummary = {
  stripe_subscription_id: string;
  status: 'active' | 'past_due' | 'incomplete' | 'canceled' | 'trialing';
  tier: string | null;
  billing_mode: 'monthly' | 'annual' | string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_amount_cents: number;
  last_payment_at: string | null;
  latest_invoice_id: string | null;
} | null;

type Usage = {
  driversTotal: number;
  driversUsed: number;
  driversLeft: number;
  stopsTotal: number;
  stopsUsed: number;
  stopsLeft: number;
  asOf: string;
} | null;

/* ───────────────── utils ───────────────── */
const money = (cents?: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(Math.round(cents || 0) / 100);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.max(0, Math.min(100, (n / d) * 100));
}

/* ───────────────── screen ───────────────── */
export default function ManageSubscriptionScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();
  const businessId = business?.id;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [subscription, setSubscription] = useState<SubscriptionSummary>(null);
  const [usage, setUsage] = useState<Usage>(null);
  const [paymentMethods, setPaymentMethods] = useState<PM[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState<InvoiceOpen | null>(null);

  const statusChip = useMemo(() => {
    const s = subscription?.status || '—';
    const map: Record<string, { bg: string; fg: string }> = {
      active: { bg: '#DCFCE7', fg: '#166534' },
      past_due: { bg: '#FEF3C7', fg: '#92400E' },
      incomplete: { bg: '#FEF3C7', fg: '#92400E' },
      canceled: { bg: '#F3F4F6', fg: '#374151' },
      trialing: { bg: '#E0F2FE', fg: '#075985' },
      '—': { bg: colors.border, fg: colors.text },
    };
    return map[s] || map['—'];
  }, [subscription?.status, colors.border, colors.text]);

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Expecting your API to return: { success, data: { subscription, usage, paymentMethods, invoiceOpen } }
      const { success, data, message } = await api.get<{
        success: boolean;
        data: {
          subscription: SubscriptionSummary;
          usage: Usage;
          paymentMethods: PM[];
          invoiceOpen: InvoiceOpen | null;
        } | null;
        message?: string | null;
        error?: any | null;
      }>(`/billing/summary?businessId=${businessId}`);

      if (!success || !data) {
        throw new Error(message || 'Failed to load subscription.');
      }

      setSubscription(data.subscription || null);
      setUsage(data.usage || null);
      setPaymentMethods(data.paymentMethods || []);
      setInvoiceOpen(data.invoiceOpen || null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load subscription.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ─────────────── actions ─────────────── */

  const addCard = useCallback(async () => {
    if (!businessId) return;
    try {
      setBusy(true);
      // Your server should create a SetupIntent + ephemeral key + customer
      const { success, data, message } = await api.post<{
        success: boolean;
        data: {
          setupIntentClientSecret: string;
          customerId: string;
          ephemeralKey: string;
        } | null;
        message?: string | null;
      }>('/billing/payment-sheet', {
        businessId,
        email: business?.email || '', // adjust if you keep email on business
        name: business?.name || '',
        createIfMissing: true,
      });

      if (!success || !data) throw new Error(message || 'Server error');

      const { error } = await initPaymentSheet({
        customerId: data.customerId,
        customerEphemeralKeySecret: data.ephemeralKey,
        setupIntentClientSecret: data.setupIntentClientSecret,
        merchantDisplayName: 'Movaro',
        allowsDelayedPaymentMethods: false,
      });
      if (error) throw new Error(error.message);

      const res = await presentPaymentSheet();
      if (res.error) throw new Error(res.error.message);

      Alert.alert('Card added', 'Your card was saved.');
      load();
    } catch (e: any) {
      Alert.alert('Add card failed', e?.message || 'Could not add card.');
    } finally {
      setBusy(false);
    }
  }, [business?.email, business?.name, businessId, load]);

  const makeDefault = useCallback(
    async (paymentMethodId: string) => {
      try {
        setBusy(true);
        const { success, message } = await api.post<{
          success: boolean;
          message?: string | null;
        }>('/billing/payment-methods/default', { businessId, paymentMethodId });
        if (!success) throw new Error(message || 'Failed to set default card');
        load();
      } catch (e: any) {
        Alert.alert('Could not set default', e?.message || 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [businessId, load],
  );

  const removeCard = useCallback(
    async (paymentMethodId: string) => {
      Alert.alert('Remove card', 'Are you sure you want to remove this card?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              const { success, message } = await api.post<{
                success: boolean;
                message?: string | null;
              }>(`/billing/payment-methods/${paymentMethodId}/detach`, {
                businessId,
              });
              if (!success) {
                throw new Error(message || 'Remove failed');
              }
              load();
            } catch (e: any) {
              Alert.alert('Remove failed', e?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [businessId, load],
  );

  const payOpenInvoice = useCallback(async () => {
    if (!invoiceOpen?.id) return;
    try {
      setBusy(true);
      const { success, message } = await api.post<{
        success: boolean;
        message?: string | null;
      }>(`/billing/invoices/${invoiceOpen.id}/pay`, {});
      if (!success) throw new Error(message || 'Payment failed');
      Alert.alert(
        'Payment submitted',
        'If bank approval is required, you may receive a prompt.',
      );
      load();
    } catch (e: any) {
      Alert.alert('Payment failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [invoiceOpen?.id, load]);

  const cancelAtPeriodEnd = useCallback(() => {
    Alert.alert(
      'Cancel subscription',
      'Cancel at the end of the current period?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              const { success, message } = await api.post<{
                success: boolean;
                message?: string | null;
              }>('/billing/subscription/cancel', {
                businessId,
                atPeriodEnd: true,
              });
              if (!success) throw new Error(message || 'Cancel failed');
              load();
            } catch (e: any) {
              Alert.alert('Cancel failed', e?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [businessId, load]);

  const reactivate = useCallback(async () => {
    try {
      setBusy(true);
      const { success, message } = await api.post<{
        success: boolean;
        message?: string | null;
      }>('/billing/subscription/reactivate', { businessId });
      if (!success) throw new Error(message || 'Reactivate failed');
      load();
    } catch (e: any) {
      Alert.alert('Reactivate failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [businessId, load]);

  /* ─────────────── UI ─────────────── */

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1 items-center justify-center`]}>
        <ActivityIndicator />
        <Text style={tw`mt-2 text-gray-500`}>Loading subscription…</Text>
      </SafeAreaView>
    );
  }

  const s = subscription;
  const driverPct = pct(usage?.driversUsed || 0, usage?.driversTotal || 0);
  const stopsPct = pct(usage?.stopsUsed || 0, usage?.stopsTotal || 0);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-3 pb-2 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold ml-2`, { color: colors.text }]}>
          Manage Subscription
        </Text>
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-24`}>
        {/* Subscription Summary */}
        <View
          style={[
            tw`rounded-2xl p-4 mb-3`,
            {
              backgroundColor: colors.main,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
              {(s?.tier || '—').toString().toUpperCase()} (
              {s?.billing_mode || '—'})
            </Text>
            <View
              style={[
                tw`px-2 py-0.5 rounded`,
                { backgroundColor: statusChip.bg },
              ]}
            >
              <Text
                style={[
                  tw`text-[11px] font-semibold`,
                  { color: statusChip.fg },
                ]}
              >
                {String(s?.status || '—').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
            Period: {fmtDate(s?.current_period_start)} –{' '}
            {fmtDate(s?.current_period_end)} • Amount:{' '}
            {money(s?.payment_amount_cents)}
          </Text>
          {s?.cancel_at_period_end ? (
            <Text style={[tw`text-[11px] mt-1`, { color: '#92400E' }]}>
              Cancellation scheduled at period end.
            </Text>
          ) : null}
        </View>

        {/* Usage */}
        <View
          style={[
            tw`rounded-2xl p-4 mb-3`,
            {
              backgroundColor: colors.main,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[tw`text-base font-semibold mb-2`, { color: colors.text }]}
          >
            Usage
          </Text>

          {/* Drivers */}
          <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
            Drivers: {usage?.driversUsed ?? 0} / {usage?.driversTotal ?? 0}{' '}
            (left {usage?.driversLeft ?? 0})
          </Text>
          <View
            style={[tw`h-2 rounded mb-3`, { backgroundColor: colors.border }]}
          >
            <View
              style={tw.style(`h-2 rounded`, {
                width: `${driverPct}%`,
                backgroundColor: '#38BDF8',
              })}
            />
          </View>

          {/* Stops */}
          <Text style={[tw`text-xs mb-1`, { color: colors.muted }]}>
            Stops: {usage?.stopsUsed ?? 0} / {usage?.stopsTotal ?? 0} (left{' '}
            {usage?.stopsLeft ?? 0})
          </Text>
          <View style={[tw`h-2 rounded`, { backgroundColor: colors.border }]}>
            <View
              style={tw.style(`h-2 rounded`, {
                width: `${stopsPct}%`,
                backgroundColor: '#38BDF8',
              })}
            />
          </View>
        </View>

        {/* Payment Methods */}
        <View
          style={[
            tw`rounded-2xl p-4 mb-3`,
            {
              backgroundColor: colors.main,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
              Cards on file
            </Text>
            <TouchableOpacity disabled={busy} onPress={addCard}>
              <Text
                style={[
                  tw`font-semibold`,
                  {
                    color: busy
                      ? '#93C5FD'
                      : colors.brand?.primary || '#2563eb',
                  },
                ]}
              >
                Add card
              </Text>
            </TouchableOpacity>
          </View>

          {paymentMethods.length === 0 ? (
            <Text style={[tw`text-xs`, { color: colors.muted }]}>
              No cards saved.
            </Text>
          ) : (
            paymentMethods.map(pm => (
              <View
                key={pm.id}
                style={[tw`py-3 border-t`, { borderColor: colors.border }]}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={{ color: colors.text }}>
                    {pm.brand?.toUpperCase()} •••• {pm.last4}{' '}
                    {pm.exp_month ? `(${pm.exp_month}/${pm.exp_year})` : ''}
                  </Text>
                  {pm.isDefault ? (
                    <View
                      style={[
                        tw`px-2 py-0.5 rounded`,
                        { backgroundColor: '#DCFCE7' },
                      ]}
                    >
                      <Text
                        style={[
                          tw`text-[11px] font-semibold`,
                          { color: '#166534' },
                        ]}
                      >
                        DEFAULT
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={tw`flex-row mt-2`}>
                  {!pm.isDefault ? (
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => makeDefault(pm.id)}
                      style={tw`mr-4`}
                    >
                      <Text
                        style={[
                          tw`font-semibold`,
                          {
                            color: busy
                              ? '#93C5FD'
                              : colors.brand?.primary || '#2563eb',
                          },
                        ]}
                      >
                        Make default
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {!pm.isDefault ? (
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => removeCard(pm.id)}
                    >
                      <Text
                        style={[
                          tw`font-semibold`,
                          { color: busy ? '#FCA5A5' : '#ef4444' },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Billing / Open invoice */}
        <View
          style={[
            tw`rounded-2xl p-4 mb-3`,
            {
              backgroundColor: colors.main,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[tw`text-base font-semibold mb-2`, { color: colors.text }]}
          >
            Billing
          </Text>
          {invoiceOpen ? (
            <>
              <Text style={{ color: colors.text }}>
                Open invoice: {money(invoiceOpen.amount_due_cents)}
              </Text>
              <View style={tw`flex-row mt-2`}>
                <TouchableOpacity
                  onPress={payOpenInvoice}
                  disabled={busy}
                  style={tw`mr-4`}
                >
                  <Text
                    style={[
                      tw`font-semibold`,
                      {
                        color: busy
                          ? '#93C5FD'
                          : colors.brand?.primary || '#2563eb',
                      },
                    ]}
                  >
                    Pay now
                  </Text>
                </TouchableOpacity>
                {invoiceOpen.hosted_invoice_url ? (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(invoiceOpen.hosted_invoice_url!)
                    }
                  >
                    <Text
                      style={[
                        tw`font-semibold`,
                        { color: colors.brand?.primary || '#2563eb' },
                      ]}
                    >
                      View invoice
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={[tw`text-xs`, { color: colors.muted }]}>
              Account is up to date.
            </Text>
          )}
        </View>

        {/* Manage Subscription actions */}
        <View
          style={[
            tw`rounded-2xl p-4`,
            {
              backgroundColor: colors.main,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[tw`text-base font-semibold mb-2`, { color: colors.text }]}
          >
            Manage subscription
          </Text>
          {!subscription?.cancel_at_period_end ? (
            <TouchableOpacity disabled={busy} onPress={cancelAtPeriodEnd}>
              <Text style={[tw`font-semibold`, { color: '#ef4444' }]}>
                Cancel at period end
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity disabled={busy} onPress={reactivate}>
              <Text
                style={[
                  tw`font-semibold`,
                  { color: colors.brand?.primary || '#2563eb' },
                ]}
              >
                Reactivate
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {busy ? (
        <View style={tw`absolute bottom-4 left-0 right-0 items-center`}>
          <ActivityIndicator />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
