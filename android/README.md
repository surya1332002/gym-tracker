# ARC FIT Android development build

Native package `com.arcfit.app`, version `1.0.0` (code `1`), Capacitor 8.5.3. This project packages the existing web application. Native app storage is separate from the browser/PWA: sign in normally to load server data; unsynced browser workouts remain in that browser. Never clear either app's storage to fix presentation or updates.

## Build prerequisites

Use Node 22+, JDK **21** (recommended), Android Studio Otter 2025.2.1+ and its SDK Manager. Install Android SDK Platform **36**, Build Tools **35.0.0** (AGP 8.13 default), command-line tools and platform-tools. Review Android licenses yourself. Set `JAVA_HOME` to that JDK and `ANDROID_HOME` to your SDK directory. The pinned Gradle 8.14.3 supports running on JDK 21-24; the locally found JDK 25 cannot run it. Do not upgrade Gradle independently to bypass this requirement.

Portable tools can stay in ignored `.android-local/toolchain/`; supply your own SDK path. A portable official Temurin JDK 21 archive has now been downloaded there, its published SHA-256 verified, and Java 21 execution checked. The pinned Gradle 8.14.3 wrapper was downloaded and `--version` succeeded using that JDK and the local `.android-local/toolchain/gradle-cache/`. No system installation or permanent environment change was made. Google's SDK download/use requires owner acceptance of its SDK License Agreement; SDK download, license acceptance and SDK component installation remain pending that acceptance. Native build dependency downloads are cached under ignored `android/.gradle-cache/` by the build helper. An initial build requires network access to Gradle/Maven repositories.

From the repository root, run the guarded web build and native synchronization scripts documented in the project Android handoff, then:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File android/build-debug.ps1
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. It is a development build, signed with Android's development key, and must stay uncommitted. Updating an existing installed native build requires the same signing key and package; preserve them to preserve its local app storage. Ephemeral CI debug signing keys do not provide a stable upgrade path.

Release packaging reads `ARC_ANDROID_KEYSTORE_PATH`, `ARC_ANDROID_KEYSTORE_PASSWORD`, `ARC_ANDROID_KEY_ALIAS` and `ARC_ANDROID_KEY_PASSWORD` from the environment. Supply an absolute path to an owner-controlled private keystore and keep all four values in CI secrets. No keystore has been created or configured locally. Debug builds work without these variables; release packaging fails closed if they are missing or the file is unavailable, and never falls back to debug signing. The owner must retain the same release key for upgrades. Never commit the keystore, passwords or generated APK/AAB.

## Presentation

`MainActivity` uses AndroidX `EdgeToEdge.enable` and dark `SystemBarStyle` for light status/navigation icons. Capacitor's bundled `SystemBars` handles real `WindowInsetsCompat` system bars, display cutouts and keyboard insets. Its native mode forwards insets to modern WebView CSS `env(safe-area-inset-*)`, or applies native padding with zero CSS insets for WebViews older than 140, preventing duplicate padding. System controls stay visible. Transparent bars on modern Android draw over the black app chrome; older implementations use the dark scrim. No fixed device-specific status-bar heights or edge-to-edge opt-out flags are used.

Launcher and splash images derive only from `public/icons/arc-fit-512.png`. Recreate density-specific icons with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File android/tools/generate-branding.ps1
```

The adaptive foreground includes extra safe space for launcher masks. Android 12+ uses the platform splash theme and foreground mark; older splash rendering uses the centered original PNG on black. OS cloud backup is disabled to protect native private storage; this does not delete local or server data.

## Verification boundary (2026-10-20)

`cap add android` completed successfully and discovered App, SplashScreen and CapacitorUpdater plugins. Branding generation completed. Native source and upstream WindowInsets handling were inspected. Portable JDK 21 and Gradle 8.14.3 `--version` now pass. Native compilation/APK generation, Android lint, release-signing execution and connected-device tests remain **unverified**: SDK setup is pending explicit owner acceptance of Google's SDK License Agreement. No SDK license was silently accepted and no SDK components installed. The existing direct JDK 25 binary runs but is incompatible with this wrapper; the PATH Oracle Java shim hangs.

Before distributing a build, execute assembleDebug plus Android lint, then test on a physical Android device or emulator: gesture and three-button navigation; cutout portrait/landscape; keyboard open/close on login and set logging; light/dark theme with readable system icons; all five routes and hardware Back; cold launch/splash; account authentication; offline workout save/reopen/reconnect without duplicates; and signed OTA staging/rollback with edits pending. Desktop responsive tests cannot prove any of these native behaviors.

Official references: [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0), [SystemBars](https://capacitorjs.com/docs/apis/system-bars), [Android edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge), [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html).
