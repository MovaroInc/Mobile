import { FlatList, Text, TextInput, TouchableOpacity } from 'react-native';

import { View } from 'react-native';
import { Search } from 'react-native-feather';
import tailwind from 'twrnc';

export default function FieldSuggestions(props: any) {
  const {
    label,
    colors,
    flex,
    suggestions,
    setSuggestions,
    setQuery,
    setAddress,
    ...rest
  } = props;
  return (
    <View style={[flex ? tailwind`flex-1` : undefined, tailwind`mb-3`]}>
      <Text style={tailwind`text-gray-400 text-xs mb-1`}>{label}</Text>
      <View
        style={[
          tailwind`flex-row items-center px-3 py-2 rounded-xl  ${
            suggestions.length > 0 ? 'rounded-b-none' : ''
          }`,
          { backgroundColor: colors.border },
        ]}
      >
        <Search width={16} height={16} color="#9CA3AF" />
        <TextInput
          {...rest}
          placeholderTextColor={'#9CA3AF'}
          placeholder="Search"
          style={[
            tailwind` flex-1 ml-2`,
            { color: colors.text, backgroundColor: colors.border },
          ]}
        />
      </View>
      <FlatList
        data={suggestions}
        style={{
          backgroundColor: colors.border,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        }}
        renderItem={({ item }) => {
          return (
            <TouchableOpacity
              onPress={() => {
                setQuery(item.description);
                setAddress(item.description);
                setSuggestions([]);
              }}
              style={[
                tailwind`p-3 border-b border-gray-200`,
                {
                  backgroundColor: colors.border,
                  borderBottomColor: colors.borderSecondary,
                },
              ]}
            >
              <Text style={[tailwind`text-sm`, { color: colors.text }]}>
                {item.description}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
