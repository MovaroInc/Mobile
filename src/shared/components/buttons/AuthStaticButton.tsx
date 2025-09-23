import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle, ChevronRight, XCircle } from 'react-native-feather';
import tailwind from 'twrnc';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  label: string;
  loading: boolean;
  onPress: () => void;
  color?: string;
  valid?: boolean;
};

const AuthStaticButton = ({ label, loading, onPress, color, valid }: Props) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tailwind`w-full rounded-3 px-3 mt-4  h-12 flex flex-row justify-center items-center`,
        { backgroundColor: valid ? color : colors.brand.secondary },
      ]}
    >
      <View>
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <View style={tailwind`flex-row items-center`}>
            {valid ? (
              <CheckCircle color="white" height={20} width={20} />
            ) : (
              <XCircle color="white" height={20} width={20} />
            )}
            <Text style={tailwind`text-white font-semibold ml-2`}>{label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default AuthStaticButton;
