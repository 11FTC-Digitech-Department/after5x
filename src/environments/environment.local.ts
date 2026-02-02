// Local Supabase instance. Use with: ng serve --configuration=local
// Ensure local Supabase is running: supabase start
// Get API URL and anon key: supabase status

export const environment = {
  production: false,
  appUrl: 'http://localhost:8100',
  supabase: {
    url: 'http://127.0.0.1:54321',
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
