// src/navigation/components/TabIcon.tsx
import React from 'react';
import { View } from 'react-native';
import tailwind from 'twrnc';
import * as Feather from 'react-native-feather';

type FeatherName = keyof typeof Feather;

type Props = {
  name: FeatherName; // e.g., "Users", "List", "Map", "FileText", "User"
  color: string;
  focused: boolean;
  size?: number;
  strokeWidth?: number;
};

export default React.memo(function TabIcon({
  name,
  color,
  focused,
  size = 22,
  strokeWidth = 2,
}: Props) {
  const IconComp = (Feather[name] as React.ElementType) ?? Feather.Circle; // fallback
  return (
    <View style={tailwind`items-center`}>
      <View
        style={[
          tailwind`w-8 mb-1`,
          { height: 3, backgroundColor: focused ? '#3B82F6' : 'transparent' },
        ]}
      />
      <IconComp
        stroke={color}
        width={size}
        height={size}
        strokeWidth={strokeWidth}
      />
    </View>
  );
});
