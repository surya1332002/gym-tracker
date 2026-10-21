# ARC FIT HTTPS development preview

Status: local configuration prepared; Netlify authorization is required. No preview URL has been created or verified. The existing production site and main branch have not been changed.

Local verification on 2026-10-20: 19 preview/auth-device/encrypted-workout/offline tests passed; TypeScript passed; the guarded develop preview production build passed using public Supabase configuration. Generated release-cache coverage, manifest/icons and private-marker checks passed. Netlify showed its login page, with no local Netlify CLI token/project link available. No Git push, hosted deployment, Supabase settings change or real workout write occurred.

## One-time Netlify steps

1. Sign in at https://app.netlify.com/ using the account that owns this repository's Netlify deployment. Complete any login/terms/authorization yourself. Do not edit the existing production project.
2. Push the approved commits with `git push origin develop`. In Netlify, choose **Add new project > Import an existing project > GitHub**, then select `surya1332002/gym-tracker`. If GitHub authorization is requested, authorize only the required repository.
3. Create a **new, separate project**, suggested name `arc-fit-develop` if available. Set **Branch to deploy: develop**, base directory to repository root, build command `npm run build:develop-preview`, and publish directory `dist`. The committed `netlify.toml` uses this same command for develop and Node 22. Its default/main build remains `npm run build`. A new development project's own primary deploy may be labelled "Production" by Netlify; it must be a separate project ID from the existing main deployment.
4. In the new development project's **Project configuration > Environment variables**, add only these two public values, with **Builds** scope and the new project's deploy context:

   | Variable | Value source |
   | --- | --- |
   | `VITE_SUPABASE_URL` | The existing local `.env.local` value with this exact name |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | The existing local `.env.local` value with this exact name; Supabase publishable key or legacy anon key only |

   Copy those two entries individually. **Do not import/upload `.env.local`**, because it also contains a privileged administrator credential. Do not configure secret/service-role keys in this frontend project. Public Vite variables are intentionally included in browser JavaScript; ownership is enforced by the existing Supabase RLS, not by hiding this public key.
5. Deploy the new project from develop. Record the actual assigned HTTPS URL; `https://arc-fit-develop.netlify.app` is only a suggested name, not an existing verified URL. Subsequent pushes to develop should rebuild only this separate project. Leave the original project's main branch, domains, environment and published deploy unchanged.
6. In the existing Supabase project's **Authentication > URL Configuration**, retain its production **Site URL** and existing redirect entries. Add the exact development HTTPS origin and `https://YOUR-DEVELOP-SITE.netlify.app/**` to **Redirect URLs** for confirmation/recovery links. Do not change RLS, auth policies or the production Site URL. Password login uses the existing project; the allowlist matters for redirect-based flows.

If the repo has not already been authorized for this Netlify account, stop at that authorization and complete it manually. No replacement production project, paid plan or custom domain is required.

## Verification after the URL exists

- Open the actual HTTPS URL, sign in using the existing account, refresh, and verify the same account remains signed in. A new HTTPS origin does not inherit the old LAN/local browser's login or encrypted device cache. Do not copy tokens or browser storage between origins.
- Open a saved programme/day and the existing unfinished workout read-only. Check exercise order and existing completion state. Do not create/finish synthetic workouts or change real set values during verification. Refresh direct `/workout/start`, `/exercises/my-list` and `/profile` URLs to verify the SPA fallback.
- Confirm the manifest and `/service-worker.js` load successfully, the service worker installs, and the public release chunks are cached. On Android Chrome use **Install app/Add to Home screen** when available. On iPhone Safari use **Share > Add to Home Screen > Open as Web App**. An install prompt is browser-dependent; HTTPS alone does not prove installation was tested.
- While online, explicitly configure offline access in **Profile > Data and privacy**, using a private passphrase entered only by the user. Let the existing workout and library finish loading/caching. Reload once after service-worker activation before switching off connectivity.
- Enable airplane mode on the phone and cold-open the installed app. Unlock the existing account's encrypted device cache with the passphrase. Verify the cached workout and unmodified sets load. Restore connectivity and confirm the same session remains available with no new completed sets or duplicate records. Without prior online device setup/cache, offline login/startup is unsupported and must fail closed.
- If a real offline edit/reconnect test is wanted, perform it only during an actual workout or in isolated fixtures. The requested no-data-change check must not mark any real set completed or fabricate history.

## Local checks and deployment boundary

`npm run build:develop-preview` requires `BRANCH=develop` plus the two public Supabase variables. It rejects missing/privileged configuration, calls the existing Vite build, and verifies the generated manifest, icon files, versioned public cache and absence of private import/credential markers. It does not upload files or call Netlify.

The existing React Router `/* -> /index.html` rewrite and service-worker `Cache-Control: no-cache` rule remain in `netlify.toml`. No Netlify CLI linking state, auth token, private CSV or environment file should be committed or uploaded.

Live HTTPS authentication, session persistence, workout loading, phone installation and offline recovery remain **unverified until Netlify login/site creation and user login/device setup are complete**. Local fixture tests or successful builds are not substituted for those live checks.

References: [Netlify Vite build setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [Netlify deploy contexts](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
