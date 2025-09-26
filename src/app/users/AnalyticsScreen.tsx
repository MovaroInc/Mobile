import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import tailwind from 'twrnc';
import { useTheme } from '../../shared/hooks/useTheme';
import { useProfile } from '../../state/useSession';
import { useSession } from '../../state/useSession';
import { supabase } from '../../shared/lib/supabase';
const AnalyticsScreen = () => {
  const { colors } = useTheme();
  const { setSignedOut } = useSession();
  const profile = useProfile();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut(); // kill Supabase session
    } finally {
      // make sure local state is cleared no matter what
      setSignedOut(); // clears ids/entities + marks signedOut + bootstrapped=true
    }
  };

  return (
    <View style={[tailwind`mt-12`, { color: colors.text }]}>
      <Text style={{ color: colors.text }}> Analytics Screen</Text>
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={{ color: colors.text }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AnalyticsScreen;
