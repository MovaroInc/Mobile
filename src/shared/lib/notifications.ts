import { Platform, PermissionsAndroid } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

type IOSPerms = { alert?: boolean; badge?: boolean; sound?: boolean };

export async function checkIOSPermissions(): Promise<IOSPerms> {
  return new Promise(resolve => {
    try {
      PushNotificationIOS.checkPermissions((p: IOSPerms) => resolve(p || {}));
    } catch {
      resolve({});
    }
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      // 1) CHECK
      const current = await checkIOSPermissions();
      const alreadyEnabled = !!(
        current.alert ||
        current.badge ||
        current.sound
      );
      if (alreadyEnabled) return true;

      // 2) REQUEST
      const perms = await PushNotificationIOS.requestPermissions();
      return !!(perms?.alert || perms?.badge || perms?.sound);
    }

    // ANDROID
    if (Platform.Version < 33) {
      // No runtime permission needed pre-Android 13
      return true;
    }

    // 1) CHECK
    const has = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (has) return true;

    // 2) REQUEST
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
