import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonIcon, IonSpinner } from '@ionic/angular/standalone';

export type StatsCardColor = 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'tertiary';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonIcon, IonSpinner],
  templateUrl: './stats-card.component.html',
  styleUrls: ['./stats-card.component.scss']
})
export class StatsCardComponent {
  @Input() icon?: string;
  @Input() value: string | number = 0;
  @Input() label: string = '';
  @Input() subtitle?: string;
  @Input() color: StatsCardColor = 'primary';
  @Input() loading: boolean = false;
  @Input() clickable: boolean = false;

  @Output() cardClick = new EventEmitter<void>();

  onCardClick(): void {
    if (this.clickable && !this.loading) {
      this.cardClick.emit();
    }
  }
}
