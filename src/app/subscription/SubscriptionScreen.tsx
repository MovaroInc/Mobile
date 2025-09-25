import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../shared/hooks/useTheme';
import { useSession } from '../../state/useSession';
import tailwind from 'twrnc';
import { plans } from '../../shared/utils/subscriptions';
import SubscriptionCard from '../../shared/components/cards/SubscriptionCard';
import TempStandardButton from '../../shared/components/buttons/TempStandardButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const SubscriptionScreen = () => {
  const { colors } = useTheme();
  const { setSignedOut } = useSession();
  const navigation = useNavigation();

  const subscriptions = plans;

  const [term, setTerm] = useState<'monthly' | 'annual'>('monthly');
  const [title, setTitle] = useState('startup');
  const [selectedPlan, setSelectedPlan] = useState<string>('startup-1');
  const [selectedTier, setSelectedTier] = useState<string>('startup');

  const selectingAPlan = async (plan: any, tier: any) => {
    setSelectedPlan(plan.id);
    setSelectedTier(tier.id);
    console.log('selectedPlan', plan);
    console.log('selectedTier', tier);
    console.log('selectedTerm', term);
    await AsyncStorage.setItem('selectedPlan', JSON.stringify(plan));
    await AsyncStorage.setItem('selectedTier', JSON.stringify(tier));
    await AsyncStorage.setItem('selectedTerm', term);
  };

  const nextScreen = async () => {
    navigation.navigate('Addons');
  };

  return (
    <View style={tailwind`flex-1 items-center justify-between p-4`}>
      {/* Accent bar */}
      <View style={tailwind`w-full flex-1 items-start justify-start`}>
        <View
          style={tailwind`w-full flex flex-row items-center justify-between`}
        >
          <View>
            <Text
              style={[tailwind`text-2xl font-semibold`, { color: colors.text }]}
            >
              Subscription
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (selectedPlan) {
                setSignedOut();
              }
            }}
          >
            <Text style={[tailwind`text-base`, { color: colors.accent }]}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>
        <View style={tailwind`w-11/12 mt-3`}>
          <Text style={[tailwind`text-base`, { color: colors.text }]}>
            Select your subscription based on your needs
          </Text>
        </View>
        <View
          style={[
            tailwind`w-full flex flex-row items-center justify-between rounded-2 mt-4 p-2`,
            { backgroundColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              tailwind`w-[49%] py-2 flex items-center bg-blue-200 rounded-2`,
              {
                backgroundColor:
                  term === 'monthly' ? colors.brand.primary : colors.border,
              },
            ]}
            onPress={() => setTerm('monthly')}
          >
            <Text
              style={[
                tailwind`font-semibold`,
                { color: term === 'monthly' ? 'white' : colors.text },
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              tailwind`w-[49%] py-2 flex items-center bg-blue-200 rounded-2`,
              {
                backgroundColor:
                  term === 'annual' ? colors.brand.primary : colors.border,
              },
            ]}
            onPress={() => setTerm('annual')}
          >
            <Text
              style={[
                tailwind`font-semibold`,
                { color: term === 'annual' ? 'white' : colors.text },
              ]}
            >
              Annual (20% off)
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            tailwind`w-full flex flex-row items-center justify-between rounded-2 mt-4 p-2`,
            { backgroundColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              tailwind`w-[32%] py-2 flex items-center bg-blue-200 rounded-2`,
              {
                backgroundColor:
                  title === 'startup' ? colors.brand.primary : colors.border,
              },
            ]}
            onPress={() => setTitle('startup')}
          >
            <Text
              style={[
                tailwind`font-semibold`,
                { color: title === 'startup' ? 'white' : colors.text },
              ]}
            >
              Starter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              tailwind`w-[32%] py-2 flex items-center bg-blue-200 rounded-2`,
              {
                backgroundColor:
                  title === 'growth' ? colors.brand.primary : colors.border,
              },
            ]}
            onPress={() => setTitle('growth')}
          >
            <Text
              style={[
                tailwind`font-semibold`,
                { color: title === 'growth' ? 'white' : colors.text },
              ]}
            >
              Growth
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              tailwind`w-[32%] py-2 flex items-center bg-blue-200 rounded-2`,
              {
                backgroundColor:
                  title === 'enterprise' ? colors.brand.primary : colors.border,
              },
            ]}
            onPress={() => setTitle('enterprise')}
          >
            <Text
              style={[
                tailwind`font-semibold`,
                { color: title === 'enterprise' ? 'white' : colors.text },
              ]}
            >
              Enterprise
            </Text>
          </TouchableOpacity>
        </View>
        <View style={tailwind`flex-1 mt-4`}>
          {subscriptions.tiers.map(tier => {
            if (tier.id === title) {
              return (
                <View key={tier.id} style={tailwind`w-full`}>
                  <Text
                    style={[
                      tailwind`text-xl font-bold`,
                      { color: colors.text },
                    ]}
                  >
                    {tier.label}
                  </Text>
                  <Text style={[tailwind`text-sm`, { color: colors.text }]}>
                    {tier.description}
                  </Text>
                  <ScrollView style={tailwind`mb-12`}>
                    {tier.plans.map(plan => (
                      <SubscriptionCard
                        key={plan.id}
                        plan={plan}
                        tier={tier}
                        term={term}
                        title={title}
                        selected={selectedPlan}
                        onPress={selectingAPlan}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            }
          })}
        </View>
        <TempStandardButton
          label={"Addon's"}
          loading={false}
          onPress={nextScreen}
          active={selectedPlan ? true : false}
        />
      </View>
    </View>
  );
};

export default SubscriptionScreen;
