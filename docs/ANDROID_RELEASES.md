# ARC FIT Android development releases

This workflow is preparation for testing. Creating an Android project, passing web tests or building an APK does not verify installation, device storage recovery, OTA activation or rollback. Hosted Capgo delivery requires an owner-managed account and credentials. No account, paid service or hosted update is created by these scripts.

## Versions and compatibility

The first native binary uses version **1.0.0**, Android versionCode **1**. Development web bundles use `1.0.<GitHub run number>+<64-character native baseline SHA-256>`. The complete suffix is a compatibility namespace, not a security signature. Capgo supports SemVer build metadata; signatures authenticate bundle bytes separately. The runtime must require the exact namespace before downloading or activating an update.

`android-release-contract.json` declares storage contract `arc-fit-storage-1`. The baseline digest covers pinned Capacitor/Capgo/Cordova lockfile versions and integrities, Android native files, Capacitor configuration, database migrations and named vault/workout/session/programme/draft source files. Line endings are normalized. Build folders, local SDK paths, keystores, copied web assets, generated Cordova directory/config.xml and unapplied `_PROPOSAL.sql` files are excluded. `expectedBaselineHash` is excluded to avoid a circular digest. The public key fingerprint is included.

Any baseline change requires a reviewed new APK. This conservative rule also blocks harmless edits to covered files; do not bypass it to publish OTA. The entire dependency lock and dependency declarations are included because native plugins can use arbitrary package names. Pure-JavaScript dependency upgrades therefore also require native baseline review; ordinary JS/CSS/HTML application edits remain eligible. Native dependencies, native configuration, vault format, IndexedDB schema, storage origin and migration changes cannot ship through the ordinary OTA path.

Record a baseline only after reviewing a new native release:

```powershell
node scripts/android-release.mjs baseline
node scripts/android-release.mjs baseline --record
node scripts/android-release.mjs verify
```

Recording is a source preparation step. It does not prove a binary was built or distributed. OTA publication additionally requires the exact baseline copied from the previously distributed signed APK artifact. Never substitute a newly calculated value for evidence of an installed APK.

## Signing and owner setup

Use one securely backed-up Android release keystore for successive development APKs; Android requires the same certificate for in-place upgrades. No ephemeral debug key is generated. Keep the keystore, passwords, Capgo token and OTA private key outside Git. The application ID must stay stable for upgrades and existing private WebView data.

For Capgo, create the matching application and an isolated `development` channel. Configure metadata delivery targeting and require native minimum version 1.0.0. Keep production separate and inactive until a separately reviewed production release workflow exists. Record the native package baseline in Capgo when provisioning the first channel: `--fail-on-incompatible` cannot compare a missing remote baseline. The local digest guard remains mandatory even when provider metadata is absent.

Configure signing **before the first APK installation** if OTA will be used. Without a public key the APK remains usable with OTA disabled; enabling OTA later requires a new signed APK. Installed updater 8.53.1 requires an **RSA-2048 PKCS#1** public PEM with `BEGIN RSA PUBLIC KEY`. A generic SPKI `BEGIN PUBLIC KEY` or RSA-4096 key will fail Android decryption. Tooling rejects these formats before building/publishing. The fingerprint itself uses canonical DER SPKI SHA-256, which is distinct from the required PEM wrapper.

Generate the local pair once, without a provider account, network operation or private-key output:

```powershell
node scripts/android-release.mjs key-setup
$env:ARC_OTA_PUBLIC_KEY = Get-Content -Raw .android-local/ota-signing/public.pem
```

This command refuses an existing `.android-local/ota-signing` directory and never overwrites a key. It writes `private.pem` and `public.pem` in that ignored directory, prints only paths and the public fingerprint, and requests owner-only file permissions on systems that support Unix modes. On Windows, confirm the directory inherits access only for the intended account before retaining private keys. Back up the private key securely. An interrupted setup requires inspecting the existing files; do not delete a possible valid key to rerun setup.

Put the printed fingerprint in contract `publicKeySha256`, record the reviewed baseline, then build/sync with `ARC_OTA_PUBLIC_KEY` set. Transfer the private key into GitHub environment secret `CAPGO_PRIVATE_KEY` through the secret manager; do not print it in a terminal. The pinned `@capgo/cli@8.90.1` publisher uses that matching key for Capgo V2 signing. The publisher checks the pair and fingerprint. Missing fingerprints block OTA. A signing-key change requires a new native APK.

Configure GitHub environment `android-development` (with owner approval protection where available):

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `ARC_ANDROID_APP_ID` | Exact development application ID from Capacitor config |
| Variable | `ARC_OTA_PUBLIC_KEY` | PEM public signing key embedded in native config |
| Variable | `VITE_SUPABASE_URL` | Existing app endpoint |
| Variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | Public client key only |
| Secret | `ANDROID_KEYSTORE_BASE64` | Existing stable release keystore encoded as base64 |
| Secret | `ARC_ANDROID_KEYSTORE_PASSWORD` | Release keystore password |
| Secret | `ARC_ANDROID_KEY_ALIAS` | Stable signing alias |
| Secret | `ARC_ANDROID_KEY_PASSWORD` | Alias password |
| Secret | `CAPGO_TOKEN` | Scoped development app upload token |
| Secret | `CAPGO_PRIVATE_KEY` | Matching Capgo V2 private key PEM |

Signing material is passed through environment variables and temporary restricted files. Provider output is suppressed by the publisher to avoid accidental credential disclosure. Check the Capgo dashboard securely if it rejects an upload. No secret belongs in `VITE_*`, release JSON, artifacts, logs or the repository.

## Build and publication

Run **Android development release** manually on branch `develop`. Automatic development OTA on pushes is opt-in and disabled until repository variable `ARC_ENABLE_DEVELOPMENT_OTA` is exactly `true`. Only enable it after an APK has been installed and device checks pass; set repository variable `ARC_DISTRIBUTED_NATIVE_BASELINE` to that APK artifact's digest. These trigger variables must be repository variables (environment variables are unavailable when GitHub evaluates the job condition). Credentials remain in protected environment `android-development`. Every push release runs tests, typechecking, source/binary-baseline checks and the verified web build before publication. Pull requests and `main` never publish.

Choose `apk` to build Vite assets, sync Capacitor, assemble a release APK using the stable keystore, verify its Android signature and upload the APK together with `native-release.json` and `native-baseline.sha256`. Install and exercise that APK on a device before using its digest for OTA.

Choose `ota` only after that native APK has been distributed. Supply its baseline digest in `distributed_native_baseline`. The job refuses missing credentials, wrong branch/channel, mismatched data/native baseline, signing-key mismatch or release metadata mismatch. It uploads with pinned Capgo CLI, V2 signing, minimum native version, `--fail-on-incompatible` and `--no-delta` (the runtime currently accepts verified full ZIP bundles). The workflow never creates channels or modifies provider setup. Rerunning a published run number intentionally fails rather than silently overwriting an existing version; use a new workflow run.

Locally, `node scripts/android-release.mjs build` builds and syncs; `apk` additionally requires `ARC_ANDROID_KEYSTORE_PATH` and the three signing settings. Both verify the actual Git branch is `develop`, load only Vite's public-prefixed production environment values, strip nonpublic signing/server credentials from the frontend child process, reuse the existing public Supabase configuration validation and scan the generated release output before syncing it. Nonpublic server keys in `.env.local` are not printed or rejected merely for existing. Private `VITE_*` variables are rejected. Set `ARC_WEB_BUNDLE_VERSION` to the selected version before building. `node scripts/publish-android-ota.mjs` also checks the actual branch and is an actual network publication command: run only with explicit release intent, the verified distributed baseline in `ARC_NATIVE_BASELINE_SHA256`, the matching `ARC_ANDROID_APP_ID`, and development channel credentials.

## Required device validation before release claims

The Android SDK/JDK, stable keystore, installed APK and Capgo account may still be unavailable locally. Web tests alone do not satisfy these checks:

- Install the signed APK, verify ARC FIT icon/splash, native version and bundle version.
- Save an offline workout and pending edits, close/reopen, unlock the trusted account and verify exact encrypted data recovery.
- Open the app online and confirm a compatible signed update downloads without reloading the active workout or history editor.
- Close and subsequently open the app; verify activation occurs only at the safe startup boundary. Unknown, locked or unreadable safety state must defer activation while allowing the app to work.
- Confirm malformed signatures, wrong baseline namespaces and incompatible native versions never activate.
- Exercise a bundle that fails startup, verify automatic rollback, then verify offline vault/workout recovery again.
- Confirm upgrades signed with the same Android certificate preserve private IndexedDB, vault identifiers, trusted account records and outbox. Never clear WebView storage to make an update work.

Keep the previous successful bundle and native builtin available for rollback. JS rollback is not a database rollback; do not publish irreversible data transformations through OTA. `next()` and background activation are unsuitable for this app. Startup health acknowledgement must not wait for remote login or a passphrase.

Official references: [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0), [Capgo updater settings](https://capgo.app/docs/plugins/updater/settings/), [native compatibility](https://capgo.app/docs/live-updates/compatibility/), [version targeting](https://capgo.app/docs/live-updates/version-targeting/), [SemVer build metadata](https://capgo.app/docs/cli/commands/), [signing setup](https://capgo.app/docs/live-updates/encryption/).

## Current setup blockers and first installation

As of 2026-10-20, portable JDK 21 and Gradle 8.14.3 run successfully. Native web build and Capacitor sync pass. Google Android SDK installation is pending owner acceptance of the [SDK terms](https://developer.android.com/studio#command-tools). No APK has been compiled, signed or installed. No Capgo account/token or signing keys are configured, and no paid service or update has been published.

1. Review and accept Google's SDK terms, then install Platform 36, Build Tools 35.0.0 and platform-tools through Android Studio SDK Manager. Set `ANDROID_HOME` and `JAVA_HOME` (the existing portable JDK is under ignored `.android-local/toolchain/`). Alternatively, explicitly authorize SDK terms acceptance before continuing portable SDK installation.
2. Create and securely retain an Android signing keystore using Android Studio's Generate Signed Bundle / APK workflow. Keep it outside Git; enter passwords through the private wizard. Configure the four local signing environment values or the protected GitHub secrets above. Never paste passwords into source files or chat. Do not distribute ephemeral CI debug builds as the stable development app.
3. Run the one-time OTA `key-setup` above, configure its public fingerprint and public key before recording the new native baseline, and back up the private key securely. Create Capgo app `com.arcfit.app` and channel `development`, obtain a scoped upload token, and configure the documented GitHub variables/secrets. Subscription/payment needs separate owner approval if required by the selected service plan.
4. Run tests/typechecking, `npm run android:apk`, Android lint and signature verification. The signed artifact is `android/app/build/outputs/apk/release/app-release.apk`. Download the equivalent signed APK artifact if using the manual GitHub workflow.
5. Sync pending PWA workouts before transitioning; retain the existing PWA until this is verified. Install the APK on the phone once using Android's package installer. Sign in to the same Supabase account. The native app has a separate encrypted device vault; it does not inherit browser login or unsynced PWA storage.
6. Validate native login/session persistence, logging, offline recovery, cutouts, navigation modes and OTA rollback on-device. Publish an initial compatible signed development release, then optionally enable guarded push publication. The app checks/downloads automatically at opening/resume and activates only a previously downloaded verified release on a later safe startup. Active workouts, unsynced changes, dirty drafts, foreign encrypted caches and unverifiable offline state defer activation.
7. For future native changes, increase versionCode and distribute an APK signed with the **same** retained Android key. Install over the existing app (`adb install -r <signed-apk>` when using USB debugging). Never uninstall or clear app storage to upgrade. Compatible JS/CSS/HTML releases use OTA and need no APK installation.

The baseline guard protects releases made through this workflow; it cannot police out-of-band backend changes. Keep existing backend contracts backward compatible. A guarantee that an already installed old binary cannot write after an arbitrary incompatible backend change would require a server-enforced version contract, which is not added in this platform-only milestone. No current backend schema or policies were changed.
