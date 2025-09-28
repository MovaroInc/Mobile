import { Text, TextInput } from 'react-native';

import { TouchableOpacity } from 'react-native';

import { View } from 'react-native';
import tailwind from 'twrnc';

export default function SelectInput(props: any) {
  const {
    label,
    colors,
    flex,
    leftIcon,
    onPress,
    editable = true,
    required = false,
    selectedValue,
    ...rest
  } = props;
  return (
    <View style={[flex ? tailwind`flex-1` : undefined, tailwind`mb-3`]}>
      <Text style={tailwind`text-gray-400 text-xs mb-1`}>
        {label}
        {required && <Text style={tailwind`text-red-500`}>*</Text>}
      </Text>
      <TouchableOpacity activeOpacity={1} onPress={onPress}>
        <View
          style={[
            tailwind`px-3 py-2 rounded-xl flex-row items-center`,
            { backgroundColor: colors.border },
          ]}
        >
          {leftIcon ? <View style={tailwind`mr-2`}>{leftIcon}</View> : null}
          <Text style={[tailwind`flex-1`, { color: colors.text }]}>
            {selectedValue}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
