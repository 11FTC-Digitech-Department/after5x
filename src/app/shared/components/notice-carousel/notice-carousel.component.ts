import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  notificationsOutline,
  alertCircleOutline,
  timeOutline,
  closeCircle,
  chevronForward
} from 'ionicons/icons';

export type NoticeType = 'NEW_JOB' | 'UPCOMING_JOB' | 'OVERDUE_ACTION';

export interface UrgentNotice {
  id: string;
  type: NoticeType;
  title: string;
  message: string;
  bookingId?: string;
  timestamp: Date;
  priority: number;
}

@Component({
  selector: 'app-notice-carousel',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './notice-carousel.component.html',
  styleUrls: ['./notice-carousel.component.scss']
})
export class NoticeCarouselComponent {
  @Input() notices: UrgentNotice[] = [];

  @Output() noticeClick = new EventEmitter<UrgentNotice>();
  @Output() noticeDismiss = new EventEmitter<UrgentNotice>();

  constructor() {
    addIcons({
      notificationsOutline,
      alertCircleOutline,
      timeOutline,
      closeCircle,
      chevronForward
    });
  }

  onNoticeClick(notice: UrgentNotice): void {
    this.noticeClick.emit(notice);
  }

  onDismiss(event: Event, notice: UrgentNotice): void {
    event.stopPropagation();
    this.noticeDismiss.emit(notice);
  }

  getNoticeIcon(type: NoticeType): string {
    switch (type) {
      case 'NEW_JOB':
        return 'notifications-outline';
      case 'UPCOMING_JOB':
        return 'time-outline';
      case 'OVERDUE_ACTION':
        return 'alert-circle-outline';
      default:
        return 'notifications-outline';
    }
  }

  getNoticeClass(type: NoticeType): string {
    switch (type) {
      case 'NEW_JOB':
        return 'notice-new';
      case 'UPCOMING_JOB':
        return 'notice-upcoming';
      case 'OVERDUE_ACTION':
        return 'notice-urgent';
      default:
        return '';
    }
  }
}
