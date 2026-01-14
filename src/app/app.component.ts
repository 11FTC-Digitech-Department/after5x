import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SupabaseService } from './core/supabase/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  // Inject SupabaseService to ensure it initializes early and is not tree-shaken
  constructor(_supabaseService: SupabaseService) {}
}
