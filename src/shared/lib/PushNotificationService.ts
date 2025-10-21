import { Platform, PermissionsAndroid } from 'react-native';

let PushNotificationIOS: any = null;
if (Platform.OS === 'ios') {
  // defer import so Android never evaluates the module
  PushNotificationIOS =
    require('@react-native-community/push-notification-ios').default;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const perms = await PushNotificationIOS.requestPermissions();
    return !!(perms?.alert || perms?.badge || perms?.sound);
  }

  // Android
  if (Platform.Version > 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // < API 33 needs no runtime permission
}

export function getAPNSTokenIOS(): Promise<string | null> {
  if (Platform.OS !== 'ios') return Promise.resolve(null);
  return PushNotificationIOS.getDeviceToken();
}
