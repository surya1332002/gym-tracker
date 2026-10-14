# Optional coaching activation

The frontend is implemented but disabled by default. Activation requires a provider decision and the prepared `supabase/functions/training-coach/index.ts` Edge Function; no function is deployed by this milestone.

The prepared function verifies the caller with Supabase Auth, read only that caller's actual completed sets through RLS, and send only the requested exercise's relevant performance to the selected provider. Undated Excel references must be labelled undated and must never be described as completed sessions. Return `{ "analysis": "plain-text provider response" }`, or a clear error. Never write workout, routine or preference data. Keep provider credentials in Supabase Edge Function secrets, never in Vite variables. Restrict allowed browser origins and bound record count, request size, latency and output size.

After the provider and protected function are configured and verified, set the nonsecret local/build flags `VITE_AI_COACHING_ENABLED=true` and `VITE_AI_PROVIDER_LABEL` to the actual provider's name. The UI requires explicit consent and a Request analysis click each time. No background request or automated routine modification is supported.

Required decision: which provider may receive these training records, and its API credential. Production deployment remains subject to the user's separate approval.

Server configuration: AI_CHAT_ENDPOINT (an HTTPS chat-completions-compatible endpoint), AI_API_KEY, AI_MODEL, and ARC_FIT_ALLOWED_ORIGINS (comma-separated exact app origins). Set these only in Edge Function secrets. The provider endpoint/model remain unset until the user chooses a provider. Supabase builtin URL/anon key are used with the verified caller JWT and RLS; the function has no service-role client.
