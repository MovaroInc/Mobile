import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import {
  Search,
  Filter,
  Edit3,
  Copy,
  Camera,
  CreditCard,
  FileText,
  Clock,
  Plus,
  Phone,
  MapPin,
  Trash2,
  User,
  PlusCircle,
} from 'react-native-feather';
import { useSession } from '../../state/useSession';
import { grabCustomers, grabVendors } from '../../shared/lib/admiinApi';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  deleteCustomer,
  deleteVendor,
  editCustomer,
  editVendor,
} from '../../shared/lib/CustomerVendorApi';

type TabKey = 'Customers' | 'Vendors' | 'Stops';

type Customer = {
  id: number;
  name: string;
  contact?: string;
  city?: string;
  state?: string;
};
type Vendor = {
  id: number;
  name: string;
  type?: string;
  city?: string;
  state?: string;
};
type StopTemplate = {
  id: number;
  title: string;
  defaultMinutes: number;
  requiresPhoto?: boolean;
  requiresSignature?: boolean;
  requiresPayment?: boolean;
  tags?: string[];
};

export default function OperationScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme(); // expects colors.main, colors.text, colors.primary
  const { business } = useSession();
  const [tab, setTab] = useState<TabKey>('Customers');
  const [query, setQuery] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [templates, setTemplates] = useState<StopTemplate[]>([]);

  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<StopTemplate[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, []),
  );

  const loadRecords = async () => {
    const { success, data, error, message } = await grabCustomers(business?.id);
    const {
      success: vendorSuccess,
      data: vendorData,
      error: vendorError,
      message: vendorMessage,
    } = await grabVendors(business?.id);
    setCustomers(data.data);
    setVendors(vendorData.data);
    setFilteredCustomers(data.data);
    setFilteredVendors(vendorData.data);
  };

  useEffect(() => {
    console.log(filteredCustomers);
    console.log(filteredVendors);
  }, [filteredCustomers, filteredVendors]);

  const handleDeleteCustomer = async (id: number) => {
    Alert.alert(
      `Delete ${tab === 'Customers' ? 'Customer' : 'Vendor'}`,
      'Are you sure you want to delete this customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => deleteRecord(id),
        },
      ],
    );
  };

  const deleteRecord = async (id: number) => {
    if (tab === 'Customers') {
      const res = await deleteCustomer(id);
      console.log('deleteCustomer', res);
      if (!res?.data.id)
        throw new Error(res?.message || 'Failed to create customer');
      Alert.alert('Saved', 'Customer created');
      loadRecords();
    } else {
      const res = await deleteVendor(id);
      console.log('deleteVendor', res);
      if (!res?.data.id)
        throw new Error(res?.message || 'Failed to create vendor');
      Alert.alert('Saved', 'Vendor created');
      loadRecords();
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <Text style={[tw`text-2xl font-bold`, { color: colors.text }]}>
          Operations
        </Text>
      </View>

      {/* Segmented Tabs */}
      <View style={tw`px-3 mb-2`}>
        <View
          style={[
            tw`flex-row bg-black/20 rounded-xl p-1`,
            { backgroundColor: colors.border },
          ]}
        >
          {(['Customers', 'Vendors'] as TabKey[]).map(k => {
            const active = tab === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setTab(k)}
                style={[
                  tw`flex-1 py-2 rounded-lg items-center`,
                  {
                    backgroundColor: active
                      ? colors.brand.primary
                      : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? '#fff' : colors.text,
                    fontWeight: '600',
                  }}
                >
                  {k}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Search + Filter row */}
      <View style={tw`px-4 mb-3 flex-row items-center mt-2`}>
        <View
          style={[
            tw`flex-row items-center flex-1 px-3 py-2 rounded-xl mr-2`,
            { backgroundColor: colors.border },
          ]}
        >
          <Search width={18} height={18} color={colors.text} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${tab.toLowerCase()}...`}
            placeholderTextColor={'#9CA3AF'}
            style={[tw`ml-2 flex-1`, { color: colors.text }]}
          />
        </View>
        <TouchableOpacity
          style={[
            tw`px-3 py-2 rounded-xl`,
            { backgroundColor: 'rgba(255,255,255,0.06)' },
          ]}
        >
          <Filter width={18} height={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {tab === 'Customers' && (
        <FlatList
          data={filteredCustomers}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={tw`px-4 pb-28`}
          renderItem={({ item }) => {
            console.log(item);
            return (
              <TouchableOpacity
                style={[
                  tw`mb-3 px-4 py-3 rounded-2xl`,
                  { backgroundColor: 'rgba(255,255,255,0.06)' },
                ]}
              >
                <View style={tw`flex-row justify-between items-center`}>
                  <Text
                    style={[
                      tw`text-base font-semibold`,
                      { color: colors.text },
                    ]}
                  >
                    {item.name} {item.default ? '(Default)' : null}
                  </Text>
                  <View style={tw`flex-row items-center`}>
                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate('EditParty', {
                          mode: 'customer',
                          record: item,
                        });
                      }}
                      style={tw`px-2 py-1 mr-1`}
                    >
                      <Edit3 width={16} height={16} color={colors.accent} />
                    </TouchableOpacity>
                    {item.default ? null : (
                      <TouchableOpacity
                        onPress={() => {
                          handleDeleteCustomer(item.id);
                        }}
                        style={tw`px-2 py-1`}
                      >
                        <Trash2 width={16} height={16} color={'red'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={tw`flex-row items-center mt-2`}>
                  <Phone width={14} height={14} color={colors.muted} />
                  <Text style={[tw`text-sm ml-2`, { color: colors.muted }]}>
                    {item.phone || '—'}
                  </Text>
                </View>
                <View style={tw`flex-row items-center mt-2`}>
                  <MapPin width={14} height={14} color={colors.muted} />
                  <Text style={[tw`text-sm ml-2`, { color: colors.muted }]}>
                    {item.city
                      ? `${item.address_line1}, ${item.city}${
                          item.region ? `, ${item.region}` : ''
                        }`
                      : '—'}
                  </Text>
                </View>
                <View
                  style={[
                    tw`h-1 w-full my-2`,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={tw`flex-row items-center`}>
                  <View style={tw`flex-row items-center`}>
                    <User width={14} height={14} color={colors.muted} />
                    <Text style={[tw`text-sm ml-2`, { color: colors.muted }]}>
                      {item.contact_name || '—'}
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center ml-4`}>
                    <Phone width={14} height={14} color={colors.muted} />
                    <Text style={[tw`text-sm ml-2`, { color: colors.muted }]}>
                      {item.contact_phone || '—'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState label="No customers yet" cta="Add Customer" />
          }
        />
      )}

      {tab === 'Vendors' && (
        <FlatList
          data={filteredVendors}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={tw`px-4 pb-28`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                tw`mb-3 px-4 py-3 rounded-2xl`,
                { backgroundColor: 'rgba(255,255,255,0.06)' },
              ]}
            >
              <Text
                style={[tw`text-base font-semibold`, { color: colors.text }]}
              >
                {item.name}
              </Text>
              <Text style={[tw`text-sm mt-0.5`, { color: '#9CA3AF' }]}>
                {item.type || '—'}
              </Text>
              <Text style={[tw`text-sm`, { color: '#9CA3AF' }]}>
                {item.city
                  ? `${item.city}${item.state ? `, ${item.state}` : ''}`
                  : '—'}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState label="No vendors yet" cta="Add Vendor" />
          }
        />
      )}

      {tab === 'Stops' && (
        <>
          {/* Filter chips for templates */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={tw`px-4 mb-2`}
          >
            {[
              'All',
              'Delivery',
              'Pickup',
              'Inspection',
              'Photo req',
              'Signature req',
              'Payment req',
            ].map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  tw`mr-2 px-3 py-1 rounded-full`,
                  { backgroundColor: 'rgba(255,255,255,0.08)' },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 12 }}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredTemplates}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={tw`px-4 pb-28`}
            renderItem={({ item }) => (
              <TemplateCard item={item} textColor={colors.text} />
            )}
            ListEmptyComponent={
              <EmptyState label="No stop templates" cta="Add Stop Template" />
            }
          />
        </>
      )}

      {/* Contextual FAB */}
      <View style={tw`absolute right-0 bottom-0 px-3 pb-4`}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            tw`px-3 py-2 rounded-full flex-row items-center`,
            { backgroundColor: colors.brand.primary },
          ]}
          onPress={() => {
            const mode = tab === 'Customers' ? 'customer' : 'vendor';
            navigation.navigate('AddParty', { mode });
          }}
        >
          <PlusCircle width={18} height={18} color="#fff" />
          <Text style={tw`text-white ml-2 font-semibold`}>
            {tab === 'Customers'
              ? 'Add Customer'
              : tab === 'Vendors'
              ? 'Add Vendor'
              : 'Add Stop Template'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Reusable bits */

function EmptyState({ label, cta }: { label: string; cta: string }) {
  return (
    <View style={tw`flex-1 items-center justify-center mt-16`}>
      <Text style={tw`text-gray-400 mb-2`}>{label}</Text>
      <Text style={tw`text-gray-500`}>Tap “+ {cta}” to get started</Text>
    </View>
  );
}

function TemplateCard({
  item,
  textColor,
}: {
  item: StopTemplate;
  textColor: string;
}) {
  return (
    <View
      style={[
        tw`mb-3 px-4 py-3 rounded-2xl`,
        { backgroundColor: 'rgba(255,255,255,0.06)' },
      ]}
    >
      <View style={tw`flex-row justify-between items-center`}>
        <Text style={[tw`text-base font-semibold`, { color: textColor }]}>
          {item.title}
        </Text>
        <View style={tw`flex-row`}>
          <TouchableOpacity style={tw`px-2 py-1 mr-1`}>
            <Edit3 width={18} height={18} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity style={tw`px-2 py-1`}>
            <Copy width={18} height={18} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={tw`flex-row items-center mt-2`}>
        <Clock width={16} height={16} color="#9CA3AF" />
        <Text style={tw`text-gray-400 ml-1 text-xs`}>
          {item.defaultMinutes} min
        </Text>

        {item.requiresPhoto ? <IconChip Icon={Camera} label="Photo" /> : null}
        {item.requiresSignature ? (
          <IconChip Icon={FileText} label="Signature" />
        ) : null}
        {item.requiresPayment ? (
          <IconChip Icon={CreditCard} label="Payment" />
        ) : null}
      </View>

      {item.tags?.length ? (
        <View style={tw`flex-row flex-wrap mt-2`}>
          {item.tags.map(t => (
            <View
              key={t}
              style={tw`mr-2 mb-1 px-2 py-0.5 rounded-full bg-white/10`}
            >
              <Text style={tw`text-gray-300 text-xs`}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function IconChip({ Icon, label }: { Icon: any; label: string }) {
  return (
    <View style={tw`flex-row items-center ml-3`}>
      <Icon width={16} height={16} color="#9CA3AF" />
      <Text style={tw`text-gray-400 ml-1 text-xs`}>{label}</Text>
    </View>
  );
}
