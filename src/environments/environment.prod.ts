export const environment = {
  production: true,
  appUrl: 'https://app.after5.ph',
  errorReporting: {
    enabled: true,
  },
  supabase: {
    url: 'https://zqdnzbchifwwtyyjrmzx.supabase.co',
    key: 'sb_publishable_Szhgg3U8rsjPrWh2bSAxhg_Y1Kkr8G7'
  },
  googleMaps: {
    apiKey: 'AIzaSyA8rkDOlrtvIrMvu9kEcQgkUvFAs7cP-RA',
  },
  // Xendit configuration (keys stored in Supabase secrets, URLs for reference)
  xendit: {
    // Success redirect after payment
    successRedirectUrl: 'https://app.after5.ph/c/payment',
    // Failure redirect after payment
    failureRedirectUrl: 'https://app.after5.ph/c/payment',
  }
};
