import { useMemo } from 'react';

import { useState } from 'react';
import { Modal, ScrollView, TextInput, TouchableOpacity } from 'react-native';

import { Text, View } from 'react-native';
import { Search, X } from 'react-native-feather';
import tw from 'twrnc';

export default function DriverPickerModal({
  visible,
  onClose,
  drivers,
  selectedId,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  drivers: any[];
  selectedId: number | null;
  onSelect: (emp: any) => void;
  colors: any;
}) {
  const [filter, setFilter] = useState('');

  const toName = (d: any) => {
    const fn = d.Profile?.first_name?.trim() ?? '';
    const ln = d.Profile?.last_name?.trim() ?? '';
    const full = `${fn} ${ln}`.trim();
    return full || d.work_email || d.Profile?.email || 'Unnamed';
  };

  const haystackForSearch = (d: any) =>
    [
      d.Profile?.first_name ?? '',
      d.Profile?.last_name ?? '',
      d.work_email ?? '',
      d.Profile?.email ?? '',
      d.phone ?? '',
    ]
      .join(' ')
      .toLowerCase();

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(d => haystackForSearch(d).includes(q));
  }, [filter, drivers]);

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      transparent
    >
      <View style={tw`flex-1 bg-black/40`}>
        <View
          style={[
            tw`mt-auto rounded-t-3xl p-4 pb-8`,
            { backgroundColor: colors.main },
          ]}
        >
          {/* Header */}
          <View style={tw`flex-row items-center mb-3`}>
            <Text style={[tw`text-xl font-semibold`, { color: colors.text }]}>
              Select Driver
            </Text>
            <View style={tw`flex-1`} />
            <TouchableOpacity onPress={onClose}>
              <X width={22} height={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[
              tw`flex-row items-center px-3 py-2 rounded-2xl mb-3`,
              { backgroundColor: colors.border },
            ]}
          >
            <Search width={16} height={16} color="#9CA3AF" />
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search name, email, phone…"
              placeholderTextColor={'#9CA3AF'}
              style={[tw`ml-2 flex-1`, { color: colors.text }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* List */}
          <ScrollView style={tw`h-1/2`}>
            {filtered.map(d => {
              const isSel = d.id === selectedId;
              const name = toName(d);
              const subtitle =
                d.work_email || d.Profile?.email || d.phone || '';
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => onSelect(d)}
                  style={[
                    tw`px-3 py-3 rounded-2xl mb-2`,
                    {
                      backgroundColor: isSel
                        ? colors.brand?.primary
                        : colors.border,
                    },
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between `}>
                    <View style={tw`flex-1`}>
                      <View
                        style={tw`w-full flex-row items-center justify-between`}
                      >
                        <Text
                          style={[
                            tw`text-base`,
                            { color: isSel ? '#fff' : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        {d.is_driver === false && (
                          <View style={tw`ml-3 px-2 py-1 rounded-full`}>
                            <Text
                              style={[
                                tw`text-2xs`,
                                { color: isSel ? '#fff' : colors.muted },
                              ]}
                            >
                              not driver
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!subtitle && (
                        <Text
                          style={[
                            tw`text-xs mt-0.5`,
                            { color: isSel ? '#fff' : colors.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      )}
                    </View>

                    {/* Optional badge if not flagged as driver */}
                  </View>
                </TouchableOpacity>
              );
            })}

            {filtered.length === 0 && (
              <Text style={[tw`text-center py-4`, { color: colors.muted }]}>
                No drivers found
              </Text>
            )}
          </ScrollView>

          {/* Footer */}
          <TouchableOpacity
            onPress={onClose}
            style={[
              tw`mt-3 px-4 py-3 rounded-2xl items-center`,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
