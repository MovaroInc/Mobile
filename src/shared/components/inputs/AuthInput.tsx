// src/ui/AuthInput.tsx
import React, { useState } from 'react';
import {
  TextInput,
  View,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import tw from 'twrnc';
import * as Feather from 'react-native-feather'; // ← gives us an object of icons
import { useTheme } from '../../hooks/useTheme';

// Minimal props shared by feather icons
type IconProps = {
  stroke?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
};

// All available keys from react-native-feather (e.g., "User", "Lock", "Map", "Activity", ...)
export type FeatherName = keyof typeof Feather;

type Props = Omit<TextInputProps, 'onChange' | 'value'> & {
  icon: FeatherName; // ← pass "User", "Lock", "Map", etc.
  value: string;
  onChangeText: (t: string) => void;
  showSecure?: boolean;
  toggleSecure?: () => void;
};

export default function AuthInput({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  showSecure,
  toggleSecure,
  ...inputProps
}: Props) {
  const { colors } = useTheme();

  const [focused, setFocused] = useState(false);

  // Look up the component by name; fallback if invalid name is passed
  const IconComp =
    (Feather[icon] as React.ComponentType<IconProps>) || Feather.HelpCircle;

  return (
    <View
      style={[
        tw`flex-row items-center rounded-xl px-3 border-b`,
        { borderColor: colors.border },
      ]}
    >
      <IconComp stroke={colors.text} width={20} height={20} />
      <View style={tw`flex-1 py-4`}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[tw`text-base leading-1.25 ml-3`, { color: colors.text }]}
          {...inputProps}
        />
      </View>
      {showSecure && (
        <TouchableOpacity onPress={toggleSecure}>
          {secureTextEntry ? (
            <Feather.Eye stroke={colors.text} width={18} height={18} />
          ) : (
            <Feather.EyeOff stroke={colors.text} width={18} height={18} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
