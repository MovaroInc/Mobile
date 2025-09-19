import React from 'react';
import { Text, View } from 'react-native';
import tailwind from 'twrnc';

const PlaceHolderScreen = () => {
  return (
    <View style={tailwind`mt-45`}>
      <Text> Place Holder Screen</Text>
    </View>
  );
};

export default PlaceHolderScreen;
