// Generated from this template by scripts/ensure-ngrok-local.sh
// Supabase URL placeholder is replaced with active ngrok tunnel to localhost:54321
// Used for Android/device dev when local Supabase must be reachable via ngrok

export const environment = {
  production: false,
  appUrl: 'http://localhost:8100',
  supabase: {
    url: '__SUPABASE_NGROK_URL__',
    key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
  googleMaps: {
    apiKey: 'AIzaSyA8rkDOlrtvIrMvu9kEcQgkUvFAs7cP-RA',
  },
  xendit: {
    successRedirectUrl: 'http://localhost:8100/c/payment',
    failureRedirectUrl: 'http://localhost:8100/c/payment',
  },
};
