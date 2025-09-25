import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'react-native-feather';
import tailwind from 'twrnc';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  label: string;
  loading: boolean;
  onPress: () => void;
  active: boolean;
};

const TempStandardButton = ({ label, loading, onPress, active }: Props) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={active ? onPress : () => {}}
      style={[
        tailwind`w-full rounded-3 px-3 mt-4  h-12 flex flex-row justify-between items-center`,
        { backgroundColor: active ? colors.brand.primary : colors.border },
      ]}
    >
      <View />
      <View>
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={tailwind`text-white font-semibold`}>{label}</Text>
        )}
      </View>
      <View>
        <ChevronRight height={20} width={20} color={'white'} />
      </View>
    </TouchableOpacity>
  );
};

export default TempStandardButton;
