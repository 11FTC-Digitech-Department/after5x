// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  appUrl: 'http://localhost:8100',
  supabase: {
    url: 'http://127.0.0.1:54321/',
    key: '625729a08b95bf1b7ff351a663f3a23c',
  },
  oauth: {
    google: {
      clientId: 'your_dev_google_client_id' // Set via supabase/.env
    },
    facebook: {
      appId: 'your_dev_facebook_app_id' // Set via supabase/.env
    }
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
