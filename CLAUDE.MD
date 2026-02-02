# After5 - Project Overview for Claude

## ⚠️ CRITICAL DEVELOPMENT RULES

### Database Access
- **ALWAYS use `psql`** to access the local PostgreSQL database
- **DO NOT** use Supabase Studio or other GUI tools for database queries during development
- Connect via: `psql -h localhost -p 54322 -U postgres -d postgres`

### Database Migrations
- **ALWAYS use Supabase CLI** to generate migrations
- Command: `supabase migration new <migration_name>`
- **DO NOT** manually create SQL files in the migrations folder
- Apply migrations: `supabase db reset` (local) or `supabase db push` (remote)

### Development Server
- **DO NOT run dev servers** (`npm start`, `ng serve`, etc.) unless explicitly requested
- Assume the development server is already running in the background
- Only run build commands or specific scripts when asked

## Tech Stack

### Frontend
- **Ionic Framework 8.0** - Cross-platform mobile UI framework
- **Angular 20.0** - Modern web application framework with standalone components
- **Capacitor 8.0** - Native mobile runtime (iOS & Android)
- **TypeScript 5.9** - Type-safe JavaScript
- **RxJS 7.8** - Reactive programming library

### Backend
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication & authorization
  - Edge Functions for serverless logic
  - Storage for media files

### Key Capacitor Plugins
- `@capacitor/camera` - Camera access
- `@capacitor/geolocation` - Location services
- `@capacitor/google-maps` - Native Google Maps integration
- `@capacitor/preferences` - Local storage
- `@capacitor/browser` - In-app browser
- `capacitor-native-biometric` - Biometric authentication

### Third-Party Integrations
- **Xendit** - Payment processing (Indonesia-focused)
- **Google Maps API** - Location services and mapping
- **date-fns** - Date manipulation utilities

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── auth/           # Authentication logic
│   │   ├── supabase/       # Supabase client & service
│   │   ├── services/       # Business logic services
│   │   │   ├── booking.service.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── real-time.service.ts
│   │   │   ├── provider-*.service.ts
│   │   │   └── ...
│   │   └── models/         # TypeScript interfaces
│   ├── app.component.ts    # Root component
│   └── app.routes.ts       # Routing configuration
├── environments/           # Environment configs
└── assets/                # Static assets
```

## Architecture Patterns

### Dependency Injection
- All services use Angular's `inject()` function with `providedIn: 'root'`
- Services are injectable and follow single responsibility principle

### State Management
- Services hold state and expose it via RxJS observables
- Session management via `SessionService`
- Real-time updates via `RealTimeService` using Supabase subscriptions

### Routing
- Standalone component architecture (Angular 20+)
- Route-based lazy loading for optimal performance

## Key Services

### BookingService
Handles customer booking lifecycle:
- Creating bookings with multiple service items
- Fetching customer bookings
- Provider matching
- Price calculations
- Integration with payment flow

### PaymentService
Manages payment processing:
- Xendit payment integration
- Payment link generation
- Payment status tracking
- Wallet operations

### SupabaseService
Core backend integration:
- Supabase client initialization
- Database queries
- Real-time subscriptions
- Authentication state management

### Real-time Services
- `RealTimeService` - Manages Supabase real-time subscriptions
- `RealtimeManagerService` - Coordinates multiple subscription channels
- `PollingFallbackService` - Fallback when real-time fails

### Provider Services
- `ProviderMatcherService` - Matches customers with service providers
- `ProviderBookingService` - Provider-side booking management
- `ProviderDashboardService` - Provider dashboard data

## Development Workflow

### Running the App
**⚠️ DO NOT run dev servers unless explicitly requested (server is already running)**
```bash
# ONLY run these when explicitly asked:
npm start                 # Web development server (0.0.0.0:8100)
npm run start:local       # Local development (localhost)
npm run start:local-db    # Dev server using local Supabase (supabase start first)
npm run android:run:customer:local  # Android with local Supabase via ngrok (ensure-ngrok-local + build)
npm run android:run:experts:local   # Android Experts app with local Supabase via ngrok
npm run android:dev       # Android with live reload

# Build commands (safe to run):
npm run android:build     # Build for Android
npm run build             # Production build
```

### Build Configuration
- Development: `environment.ts` (remote/ngrok Supabase by default)
- Local Supabase (browser): `environment.local.ts` (use `--configuration=local` or `npm run start:local-db`)
- Local Supabase (Android/device): `environment.local-ngrok.generated.ts` from `ensure-ngrok-local.sh`; use `--configuration=local-ngrok` or `./scripts/android-build.sh ... local`
- Production: `environment.prod.ts` (via `ng build`)
- File replacements configured in `angular.json`

### Environment Variables
Located in `src/environments/environment.ts`:
- `supabase.url` - Supabase project URL
- `supabase.key` - Supabase anon/public key
- `googleMaps.apiKey` - Google Maps API key
- `xendit.*` - Payment redirect URLs

## Database Management

### Local Database Access (psql)
**ALWAYS use psql for local database queries:**
```bash
# Connect to local Supabase database
psql -h localhost -p 54322 -U postgres -d postgres

# Common psql commands
\dt              # List all tables
\d table_name    # Describe table structure
\l               # List databases
\q               # Quit
```

### Database Migrations (Supabase CLI)
**ALWAYS use Supabase CLI for migrations:**
```bash
# Create a new migration
supabase migration new <migration_name>

# Apply migrations locally
supabase db reset

# Push migrations to remote
supabase db push

# Generate migration from database changes
supabase db diff -f <migration_name>

# Check migration status
supabase migration list
```

### Database Pattern (Supabase Client - Application Code)

#### Query Pattern
```typescript
const { data, error } = await client
  .from('table_name')
  .select('*, related_table(*)')
  .eq('column', value)
```

#### Real-time Subscriptions
```typescript
client
  .channel('channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, callback)
  .subscribe()
```

## Important Notes

### Capacitor HTTP Plugin
- **CapacitorHttp is DISABLED** (capacitor.config.ts:9)
- Reason: Was stripping Authorization headers, causing 401 errors on Supabase Edge Functions
- Uses native HTTP instead

### Authentication
- Supabase handles authentication
- Session management via `SessionService`
- Biometric authentication available via `capacitor-native-biometric`

### Payment Flow
- Xendit payment gateway integration
- Payment links generated server-side (Edge Functions)
- Success/failure redirects configured per environment

### Google Maps
- Uses native Capacitor Google Maps plugin
- API key configured in both `capacitor.config.ts` and `environment.ts`

## Mobile Platform Support

### Android
- Target: Android SDK defined in `android/` directory
- Build version: 0.2.0
- App ID: `com.rockit.after5`

### iOS
- Target: iOS 16.1+
- Build version: 0.2.0
- App ID: `com.rockit.after5`

## Browser Support
- Chrome >=107
- Firefox >=106
- Edge >=107
- Safari >=16.1
- iOS Safari >=16.1

## Code Style

### TypeScript
- Uses strict TypeScript configuration
- Interfaces for type safety
- Async/await for asynchronous operations

### Angular Patterns
- Standalone components (no NgModules)
- Signal-based reactivity where applicable
- Dependency injection via `inject()`
- Services are singleton (providedIn: 'root')

### Service Injection Pattern
```typescript
@Injectable({
  providedIn: 'root'
})
export class ExampleService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
}
```

## Common Tasks

### Adding a New Service
1. Create service file in `src/app/core/services/`
2. Use `@Injectable({ providedIn: 'root' })`
3. Inject dependencies via `inject()` function
4. Follow existing service patterns

### Working with Supabase
1. Inject `SupabaseService`
2. Access client via `this.supabaseService.client`
3. Use async/await with `.from()` queries
4. Handle `{ data, error }` response pattern

### Adding Capacitor Features
1. Install plugin: `npm install @capacitor/plugin-name`
2. Sync native projects: `npx cap sync`
3. Configure in `capacitor.config.ts` if needed
4. Import and use in services/components

### Real-time Subscriptions
1. Use `RealTimeService` or `RealtimeManagerService`
2. Subscribe to specific table changes
3. Handle subscription lifecycle (subscribe/unsubscribe)
4. Implement polling fallback for reliability

## Debugging

### Common Issues
- **401 on Edge Functions**: Check that CapacitorHttp is disabled
- **Real-time not working**: Verify Supabase real-time is enabled for tables
- **Google Maps not loading**: Verify API key in both config files
- **Android build issues**: Run `npx cap sync android`

### Development Tools
- Chrome DevTools for web debugging
- Android Studio for Android debugging
- Xcode for iOS debugging
- **psql** for local database inspection (NOT Supabase Studio)
- Supabase CLI for migrations and database management

## Testing

### Unit Tests
```bash
npm test    # Run Jasmine tests via Karma
```

Test configuration:
- Jasmine 5.1 for test framework
- Karma 6.4 as test runner
- Chrome launcher for browser tests

## Version Control

Current branch: `funny-zhukovsky`
Main branch: `main`

### Recent Changes
- v0.2.0: Versioning updates for Android/iOS
- Xendit payment integration
- Improved booking experience
- UI revamp for booking forms

## Additional Resources

- Ionic Docs: https://ionicframework.com/docs
- Angular Docs: https://angular.dev
- Capacitor Docs: https://capacitorjs.com/docs
- Supabase Docs: https://supabase.com/docs
