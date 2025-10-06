// src/app/subscription/BillingHistoryScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'react-native-feather';

import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import { api } from '../../shared/lib/api';

type HistoryItem = {
  id: number | null;
  created_at: string | null;
  stripe_invoice_id: string | null;
  invoice_status: string | null; // 'paid' | 'open' | 'void' | 'uncollectible' | ...
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  subtotal_cents: number;
  tax_cents: number | null;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  receipt_url: string | null;
  customer_email: string | null;
  customer_name: string | null;
};

type PageResult = {
  items: HistoryItem[];
  nextCursor: string | null;
};

const money = (cents?: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(Math.round(cents || 0) / 100);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

export default function BillingHistoryScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { business } = useSession();
  const businessId = business?.id;

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (cursor?: string | null, replace = false) => {
      if (!businessId) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }
      try {
        const qs = new URLSearchParams({
          businessId: String(businessId),
          limit: '20',
          ...(cursor ? { cursor } : {}),
        }).toString();

        const { success, data, message } = await api.get<{
          success: boolean;
          data: PageResult | null;
          message?: string | null;
        }>(`/billing/history?${qs}`);

        if (!success || !data) {
          throw new Error(message || 'Failed to load billing history.');
        }

        setItems(prev => (replace ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor || null);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to load billing history.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [businessId],
  );

  useEffect(() => {
    fetchPage(null, true);
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    fetchPage(nextCursor, false);
  }, [loadingMore, nextCursor, fetchPage]);

  const payInvoice = useCallback(
    async (invoiceId?: string | null) => {
      if (!invoiceId) return;
      try {
        const { success, message } = await api.post<{
          success: boolean;
          message?: string | null;
        }>(`/billing/invoices/${invoiceId}/pay`, {});
        if (!success) throw new Error(message || 'Could not pay invoice.');
        Alert.alert(
          'Payment submitted',
          'If bank approval is required, you may receive a prompt.',
        );
        onRefresh();
      } catch (e: any) {
        Alert.alert(
          'Payment failed',
          e?.message || 'Could not complete payment.',
        );
      }
    },
    [onRefresh],
  );

  const statusPill = (status?: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return { bg: '#DCFCE7', fg: '#166534' };
    if (s === 'open') return { bg: '#FEF3C7', fg: '#92400E' };
    if (s === 'uncollectible' || s === 'void')
      return { bg: '#F3F4F6', fg: '#374151' };
    return { bg: colors.border, fg: colors.text };
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isOpen =
      (item.invoice_status || '').toLowerCase() === 'open' &&
      (item.amount_remaining_cents || 0) > 0;
    const pill = statusPill(item.invoice_status);

    return (
      <View
        style={[
          tw`p-4 mb-3 rounded-2xl`,
          {
            backgroundColor: colors.main,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
            {money(item.amount_due_cents, item.currency)}
          </Text>
          <View style={[tw`px-2 py-0.5 rounded`, { backgroundColor: pill.bg }]}>
            <Text style={[tw`text-[11px] font-semibold`, { color: pill.fg }]}>
              {String(item.invoice_status || '—').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[tw`text-xs mt-1`, { color: colors.muted }]}>
          Period: {fmtDate(item.period_start)} – {fmtDate(item.period_end)} •
          Created: {fmtDate(item.created_at)}
        </Text>

        <View style={tw`flex-row mt-3`}>
          {item.hosted_invoice_url ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.hosted_invoice_url!)}
              style={tw`mr-4`}
            >
              <Text
                style={{
                  color: colors.brand?.primary || '#2563eb',
                  fontWeight: '600',
                }}
              >
                View invoice
              </Text>
            </TouchableOpacity>
          ) : null}

          {item.invoice_pdf_url ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.invoice_pdf_url!)}
              style={tw`mr-4`}
            >
              <Text
                style={{
                  color: colors.brand?.primary || '#2563eb',
                  fontWeight: '600',
                }}
              >
                Download PDF
              </Text>
            </TouchableOpacity>
          ) : null}

          {isOpen && item.stripe_invoice_id ? (
            <TouchableOpacity
              onPress={() => payInvoice(item.stripe_invoice_id!)}
            >
              <Text
                style={{
                  color: colors.brand?.primary || '#2563eb',
                  fontWeight: '600',
                }}
              >
                Pay now
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          tw`flex-1 items-center justify-center`,
          { backgroundColor: colors.bg },
        ]}
      >
        <ActivityIndicator />
        <Text style={[tw`mt-2`, { color: colors.muted }]}>
          Loading billing history…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-3 pb-2 flex-row items-center`}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <ChevronLeft width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold ml-2`, { color: colors.text }]}>
          Billing History
        </Text>
      </View>

      <FlatList
        contentContainerStyle={tw`px-4 pb-10`}
        data={items}
        keyExtractor={(it, idx) =>
          `${it.stripe_invoice_id || it.id || 'x'}-${idx}`
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={tw`mt-2`} /> : <View />
        }
        ListEmptyComponent={
          <Text style={[tw`text-center mt-10`, { color: colors.muted }]}>
            No invoices yet.
          </Text>
        }
      />
    </View>
  );
}
