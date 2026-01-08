import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonFooter
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [IonFooter, 
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class WelcomePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
