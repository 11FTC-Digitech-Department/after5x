import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, peopleOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-admin-tabs',
  templateUrl: './admin-tabs.page.html',
  styleUrls: ['./admin-tabs.page.scss'],
  standalone: true,
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    CommonModule,
    RouterModule
  ]
})
export class AdminTabsPage {

  constructor() {
    addIcons({ homeOutline, peopleOutline, settingsOutline });
  }

}