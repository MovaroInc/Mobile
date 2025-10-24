// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OperationScreen from '../../../app/operations/OperationScreen';
import AddPartyScreen from '../../../app/operations/AppPartyScreen';
import EditPartyScreen from '../../../app/operations/EditPartyScreen';
import PartyOverviewScreen from '../../../app/operations/PartyOverviewScreen';
type AuthParamList = {
  Operations: undefined;
  AddParty: undefined;
  EditParty: { id: number };
  PartyOverview: { id: number; mode: 'customer' | 'vendor' };
};
const Stack = createStackNavigator<AuthParamList>();

export default function OperationsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Operations" component={OperationScreen} />
      <Stack.Screen name="AddParty" component={AddPartyScreen} />
      <Stack.Screen name="EditParty" component={EditPartyScreen} />
      <Stack.Screen name="PartyOverview" component={PartyOverviewScreen} />
    </Stack.Navigator>
  );
}
