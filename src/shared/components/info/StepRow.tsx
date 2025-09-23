import { ActivityIndicator, Text, View } from 'react-native';
import { X } from 'react-native-feather';
import { CheckCircle } from 'react-native-feather';
import tw from 'twrnc';
import { useTheme } from '../../hooks/useTheme';

const StepRow = ({
  label,
  done,
  processing,
  error,
  errorMessage,
}: {
  label: string;
  done?: boolean;
  processing?: boolean;
  error?: boolean;
  errorMessage?: string | null;
}) => {
  const { colors } = useTheme();
  return (
    <View style={tw`flex-row items-center mb-3`}>
      <View style={tw`flex flex-row items-center`}>
        <View style={tw`w-6 h-6 rounded-full items-center justify-center mr-3`}>
          {!processing && !done ? (
            <View style={tw`w-6 h-6 rounded-full bg-gray-300`} />
          ) : processing && !done ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : done ? (
            <View>
              {error ? (
                <X height={24} width={24} color={'red'} />
              ) : (
                <CheckCircle height={24} width={24} color={'green'} />
              )}
            </View>
          ) : (
            <View style={tw`w-6 h-6 rounded-full bg-gray-300`} />
          )}
        </View>
        <Text style={[tw`text-base`, { color: colors.text }]}>
          {error ? errorMessage : label}
        </Text>
      </View>
    </View>
  );
};

export default StepRow;
