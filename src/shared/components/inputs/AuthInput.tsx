// src/ui/AuthInput.tsx
import React, { useState } from 'react';
import {
  TextInput,
  View,
  TextInputProps,
  TouchableOpacity,
  Text,
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
  required?: boolean;
  isValid?: string | boolean | null;
  message?: string | null;
  error?: string;
  keyboardType?: string;
};

export default function AuthInput({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  showSecure,
  toggleSecure,
  required,
  isValid,
  message,
  keyboardType,
  ...inputProps
}: Props) {
  const { colors } = useTheme();

  const [focused, setFocused] = useState(false);

  // Look up the component by name; fallback if invalid name is passed
  const IconComp =
    (Feather[icon] as React.ComponentType<IconProps>) || Feather.HelpCircle;

  return (
    <View style={[tw`w-full px-3 border-b`, { borderColor: colors.border }]}>
      <View style={tw`flex-row items-center`}>
        <View style={tw`flex-row items-center`}>
          <IconComp stroke={colors.text} width={20} height={20} />
          {required ? (
            <Text style={[tw`text-sm text-red-500 mb-3.5`]}>{' *'}</Text>
          ) : (
            <Text style={[tw`text-sm text-red-500 mb-3.5`]}>{'  '}</Text>
          )}
        </View>
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
            autoCapitalize="none"
            {...inputProps}
            keyboardType={keyboardType}
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
      {!isValid && (
        <Text style={[tw`text-xs text-red-500 mb-3.5`]}>{message}</Text>
      )}
    </View>
  );
}
