export const environment = {
  production: true,
  appUrl: 'https://yourapp.com', // Update with your production URL
  supabase: {
    url: 'https://zqdnzbchifwwtyyjrmzx.supabase.co',
    key: 'sb_publishable_Szhgg3U8rsjPrWh2bSAxhg_Y1Kkr8G7'
  },
  googleMaps: {
    apiKey: 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4',
  },
  // Xendit configuration (keys stored in Supabase secrets, URLs for reference)
  xendit: {
    // Success redirect after payment - update with production URL
    successRedirectUrl: 'https://yourapp.com/c/payment',
    // Failure redirect after payment - update with production URL
    failureRedirectUrl: 'https://yourapp.com/c/payment',
  }
};
