import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-provider-tabs',
  templateUrl: './provider-tabs.page.html',
  styleUrls: ['./provider-tabs.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ProviderTabsPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
