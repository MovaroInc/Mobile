import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  Briefcase,
  Users,
  BarChart2,
  User,
  Inbox,
} from 'react-native-feather';

import RoutesStack from '../stacks/RoutesStack';
import OperationsStack from '../stacks/OperationsStack';
import DriversStack from '../stacks/DriversStack';
import AnalyticsStack from '../stacks/AnalyticsStack';
import ProfileStack from '../stacks/ProfileStack';
import { useTheme } from '../../../shared/hooks/useTheme';
import InboxStack from '../stacks/InboxStack';

export type ManagerTabParamList = {
  RoutesTab: undefined;
  OperationsTab: undefined;
  DriversTab: undefined;
  AnalyticsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<ManagerTabParamList>();

export default function UserTabNavigation() {
  const { colors } = useTheme();
  // expected: colors.bg (e.g., '#0B0C10'), colors.text (e.g., '#E5E7EB'), colors.primary ('#005ad0')
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
        name="RoutesTab"
        component={RoutesStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Home width={size} height={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OperationsTab"
        component={OperationsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Briefcase width={size} height={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriversTab"
        component={DriversStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Users width={size} height={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="InboxTab"
        component={InboxStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Inbox width={size} height={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <User width={size} height={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
