// src/shared/components/inputs/Stepper.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ViewStyle,
} from 'react-native';
import tailwind from 'twrnc';
import { useTheme } from '../../../shared/hooks/useTheme';

type Props = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number; // default 1
  toStops?: boolean; // shows "(x 100)" if true
  min?: number; // default 0
  max?: number; // optional hard cap
  containerStyle?: ViewStyle;
  note?: string; // optional small line under label
  rightText?: string;
};

export default function Stepper({
  label,
  value,
  onChange,
  step = 1,
  toStops = false,
  min = 0,
  max,
  containerStyle,
  note,
  rightText,
}: Props) {
  const { colors } = useTheme();

  const clamp = (n: number) => {
    const low = Math.max(min, n);
    return typeof max === 'number' ? Math.min(max, low) : low;
  };

  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  return (
    <View
      style={[
        tailwind`w-full p-3 rounded-2 mb-3`,
        { backgroundColor: colors.borderSecondary },
        containerStyle,
      ]}
    >
      <View style={tailwind`flex-row items-center justify-between`}>
        <View>
          <View style={tailwind`flex-row items-center justify-between`}>
            <Text
              style={[tailwind`text-lg font-semibold`, { color: colors.text }]}
            >
              {label}
            </Text>
            {!!rightText && (
              <Text
                style={[
                  tailwind`text-lg font-semibold`,
                  { color: colors.text },
                ]}
              >
                {rightText}
              </Text>
            )}
          </View>
          <View style={tailwind`w-full flex-row items-center justify-between`}>
            <Text style={[tailwind`text-sm mt-1`, { color: colors.text }]}>
              {toStops
                ? 'Additional stops (x 100)'
                : 'Additional drivers (x 1)'}
            </Text>
            <Text style={[tailwind`text-sm mt-1`, { color: colors.text }]}>
              {toStops ? '$11.99 ea' : '$49.99 ea'}
            </Text>
          </View>
          {!!note && (
            <Text style={[tailwind`text-xs mt-1`, { color: colors.text }]}>
              {note}
            </Text>
          )}
        </View>
      </View>

      <View style={tailwind`flex-row items-center mt-3`}>
        <TouchableOpacity
          onPress={dec}
          accessibilityRole="button"
          accessibilityLabel="Decrease"
          style={[
            tailwind`px-3 py-1 rounded-lg`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[tailwind`text-xl`, { color: colors.text }]}>–</Text>
        </TouchableOpacity>

        <TextInput
          keyboardType="number-pad"
          value={String(value)}
          onChangeText={txt => {
            const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
            onChange(clamp(Number.isFinite(n) ? n : 0));
          }}
          onBlur={() => Keyboard.dismiss()}
          style={[
            tailwind`mx-3 flex-1 py-2 rounded-lg text-center`,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        />

        <TouchableOpacity
          onPress={inc}
          accessibilityRole="button"
          accessibilityLabel="Increase"
          style={[
            tailwind`px-3 py-1 rounded-lg`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[tailwind`text-xl`, { color: colors.text }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
