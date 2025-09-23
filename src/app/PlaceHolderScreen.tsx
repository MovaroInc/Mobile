import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import tailwind from 'twrnc';
import { useProfile, useSession } from '../state/useSession';

const PlaceHolderScreen = () => {
  const profile = useProfile();
  const { setSignedOut } = useSession();
  return (
    <View style={tailwind`mt-45`}>
      <Text> Place Holder Screen</Text>
      <TouchableOpacity onPress={() => setSignedOut()}>
        <Text>Sign Out</Text>
      </TouchableOpacity>
      <Text> {JSON.stringify(profile)}</Text>
    </View>
  );
};

export default PlaceHolderScreen;
