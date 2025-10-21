// src/app/driver/DriverTabs.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../../shared/hooks/useTheme';
import {
  Map as MapIcon,
  List as ListIcon,
  Bell,
  User as UserIcon,
  ChevronLeft,
} from 'react-native-feather';
import MapStackNavigator from '../stacks/MapStackNavigator';
import InboxStackNavigator from '../stacks/InboxStackNavigator';
import TodaysStackNavigation from '../stacks/TodaysStackNavigation';
import ProfileStackNavigator from '../stacks/ProfileStackNavigator';
import { StyleSheet } from 'react-native';

/* ───────────── placeholder screens ───────────── */

/* ───────────── bottom tabs ───────────── */
const Tab = createBottomTabNavigator();

export default function DriverTabs() {
  const { colors } = useTheme();

  const borderTop = '#272a33';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // remove text under icons
        tabBarActiveTintColor: colors.brand.primary, // focused icon = primary
        tabBarInactiveTintColor: colors.text, // unfocused icon = text color
        tabBarStyle: {
          backgroundColor: colors.bg, // bar background matches app
          borderTopWidth: StyleSheet.hairlineWidth, // top border on tab bar
          borderTopColor: borderTop,
          height: 42,
        },
        tabBarIconStyle: { marginTop: 6 },
        tabBarHideOnKeyboard: true,
      }}
      sceneContainerStyle={{ backgroundColor: colors.main }} // screen content bg
    >
      <Tab.Screen
        name="DriverToday"
        component={TodaysStackNavigation}
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <ListIcon width={size} height={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={ProfileStackNavigator}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <UserIcon width={size} height={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
