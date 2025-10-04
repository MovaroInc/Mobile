// src/navigation/linking.ts
export const linking = {
  prefixes: ['https://movaro.app', 'movaro://'], // custom scheme optional for dev
  config: {
    screens: {
      // since AuthNavigation is shown when signedOut, mapping DriverSignup here is enough
      DriverSignup: 'i/:inviteId',
    },
  },
};
