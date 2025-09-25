import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import tailwind from 'twrnc';
import { useTheme } from '../../hooks/useTheme';

interface SubscriptionCardProps {
  plan: {
    id: string;
    name: string;
    drivers: {
      min: number;
      max: number;
    };
    stopsPerMonth: number;
    monthly: number;
    avgStopsPerDriverPerMonth: number;
    perStop: number;
    annual: number;
    stopsPerDriverPerDay: {
      min: number;
      max: number;
    };
  };
  tier: {
    id: string;
    label: string;
    description: string;
  };
  term: 'monthly' | 'annual';
  title: string;
  selected: string;
  onPress: (plan: any, tier: any) => void;
}
const SubscriptionCard = ({
  plan,
  tier,
  term,
  selected,
  onPress,
}: SubscriptionCardProps) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() =>
        onPress(plan, {
          id: tier.id,
          label: tier.label,
          description: tier.description,
        })
      }
      style={[
        tailwind`w-full flex  flex-col p-3 rounded-2 mt-2 border`,
        {
          backgroundColor: colors.borderSecondary,
          borderColor:
            selected === plan.id ? colors.brand.primary : colors.border,
        },
      ]}
    >
      <View style={tailwind`w-full flex flex-row items-start justify-between`}>
        <View>
          <Text style={[tailwind`text-lg font-bold`, { color: colors.text }]}>
            {plan.name}
          </Text>
        </View>
        <View style={tailwind`flex flex-col items-end`}>
          <Text
            style={[
              tailwind`text-xl font-bold`,
              { color: colors.brand.primary },
            ]}
          >
            $ {term === 'monthly' ? plan.monthly : plan.annual}{' '}
          </Text>
          <Text style={[tailwind`text-xs mt--1`, { color: colors.text }]}>
            /{term}
          </Text>
        </View>
      </View>
      <View
        style={[
          tailwind`w-full flex flex-row items-center justify-between mt-1 border-t pt-1 mt-1.5`,
          { borderColor: colors.border },
        ]}
      >
        <View>
          <Text style={[tailwind`text-xs `, { color: colors.text }]}>
            {plan.drivers.min} - {plan.drivers.max} drivers
          </Text>
        </View>
        <View>
          <Text style={[tailwind`text-xs ml-4`, { color: colors.text }]}>
            {plan.stopsPerMonth} stops /month
          </Text>
        </View>
      </View>
      <View
        style={tailwind`w-full flex flex-row items-center justify-between mt-1`}
      >
        <View>
          <Text style={[tailwind`text-xs `, { color: colors.text }]}>
            {plan.stopsPerDriverPerDay.min} - {plan.stopsPerDriverPerDay.max}{' '}
            avg. stops/day
          </Text>
        </View>
        <View>
          <Text style={[tailwind`text-xs ml-4`, { color: colors.text }]}>
            $ {plan.perStop} per stop
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default SubscriptionCard;
