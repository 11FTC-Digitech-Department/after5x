import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-job-execution',
  templateUrl: './job-execution.page.html',
  styleUrls: ['./job-execution.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class JobExecutionPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
