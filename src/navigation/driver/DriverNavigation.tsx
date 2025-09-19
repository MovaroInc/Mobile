import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TabIcon from '../components/TabIcon';
import {
  List,
  Users,
  Map as MapIcon,
  FileText,
  User,
} from 'react-native-feather';

import AdminStackNavigation from '../stacks/AdminStackNavigation';
import PlaceHolderScreen from '../../app/PlaceHolderScreen';

type AppTabParamList = {
  Tasks: undefined;
  Drivers: undefined;
  Map: undefined;
  Analytics: undefined;
  Profile: undefined;
};
const Tab = createBottomTabNavigator<AppTabParamList>();

export default function DriverNavigation() {
  return (
    <Tab.Navigator
      initialRouteName="Tasks"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: 'black',
        tabBarInactiveTintColor: 'gray',
        tabBarHideOnKeyboard: true,
        lazy: true,
        tabBarStyle: { height: 60, borderTopWidth: 0.5 },
        tabBarIcon: ({ color, focused, size }) => {
          switch (route.name) {
            case 'Tasks':
              return (
                <TabIcon
                  Icon={List}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Tasks" component={PlaceHolderScreen} />
    </Tab.Navigator>
  );
}
