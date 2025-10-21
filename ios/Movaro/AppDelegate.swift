import UIKit
import UserNotifications
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

// We MUST define the APNSTokenManager class here for it to be visible in Swift code.
// Assuming your custom files APNSTokenManager.swift and APNSTokenManagerBridge.m are correctly linked.
// ⚠️ If APNSTokenManager is in a different Swift file, this import might need adjustment.
// For now, let's assume it's correctly linked by the build system.

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // MARK: - App Launch
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // React Native setup
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Movaro", // Change if your JS root differs
      in: window,
      launchOptions: launchOptions
    )

    // Push notification setup
    UNUserNotificationCenter.current().delegate = self
    
    // ⚠️ CRITICAL CLEANUP: You must not call registerForRemoteNotifications() or
    // requestAuthorization() here if you are using PushNotificationIOS.requestPermissions() in JS.
    // However, since you are manually calling application.registerForRemoteNotifications()
    // inside your requestNotificationPermission, we must keep the call to trigger the prompt.
    // For a cleaner solution, we will keep your original setup below, but remove the
    // manual token conversion and rely on the custom module.
    requestNotificationPermission(application)

    return true
  }

  // MARK: - Push Notification Permission (Kept as is to trigger registration)
  func requestNotificationPermission(_ application: UIApplication) {
    UNUserNotificationCenter.current().requestAuthorization(
      options: [.alert, .sound, .badge]
    ) { granted, error in
      if granted {
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      } else {
        print("🔕 Notification permission denied: \(error?.localizedDescription ?? "No error")")
      }
    }
  }

  // MARK: - Push Token Success (Passing to your Custom Manager)
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    print("📲 APNs Device Token app delegate: \(token)")
    
    // 🎯 FIX: Pass the token to your custom Native Module Manager
    // This stores the token in the static property APNSTokenManager.token
    APNSTokenManager.setDeviceToken(token)
  }

  // MARK: - Push Token Failure
  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    print("❌ Failed to register for APNs: \(error.localizedDescription)")
    // Note: If you want to notify JS of this failure, you would need to add a method
    // to APNSTokenManager to handle the error.
  }
}

// MARK: - React Native Setup (Kept as is)
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - Foreground Push Handling (Kept as is)
extension AppDelegate: UNUserNotificationCenterDelegate {
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.alert, .badge, .sound])
  }
}
