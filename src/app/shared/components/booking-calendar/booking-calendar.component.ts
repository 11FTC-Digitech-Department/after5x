import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  todayOutline
} from 'ionicons/icons';
import { BookingStatus } from '@core/models/booking.model';

export type CalendarViewType = 'day' | 'week' | 'month';

export interface CalendarJob {
  id: string;
  date: Date;
  time: string;
  title: string;
  status: BookingStatus;
  customerName: string;
  address: string;
  earnings: number;
}

interface DayData {
  date: Date;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  jobs: CalendarJob[];
}

interface HourSlot {
  hour: number;
  label: string;
  jobs: CalendarJob[];
}

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [
    CommonModule,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonSpinner
  ],
  templateUrl: './booking-calendar.component.html',
  styleUrls: ['./booking-calendar.component.scss']
})
export class BookingCalendarComponent implements OnInit, OnChanges {
  @Input() jobs: CalendarJob[] = [];
  @Input() loading: boolean = false;
  @Input() initialView: CalendarViewType = 'week';

  @Output() jobClick = new EventEmitter<CalendarJob>();
  @Output() dateChange = new EventEmitter<{ start: Date; end: Date }>();
  @Output() viewChange = new EventEmitter<CalendarViewType>();

  currentView = signal<CalendarViewType>('week');
  currentDate = signal<Date>(new Date());

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Computed values
  headerTitle = computed(() => {
    const date = this.currentDate();
    const view = this.currentView();

    if (view === 'day') {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    } else if (view === 'week') {
      const weekStart = this.getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${this.monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
      } else {
        return `${this.monthNames[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} - ${this.monthNames[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getDate()}`;
      }
    } else {
      return `${this.monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
  });

  weekDaysData = computed(() => {
    const weekStart = this.getWeekStart(this.currentDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayJobs = this.jobs.filter(job => {
        const jobDate = new Date(job.date);
        jobDate.setHours(0, 0, 0, 0);
        return jobDate.getTime() === date.getTime();
      });

      return {
        date,
        dayNumber: date.getDate(),
        dayName: this.weekDays[date.getDay()],
        isToday: date.getTime() === today.getTime(),
        jobs: dayJobs
      };
    });
  });

  monthDaysData = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DayData[] = [];

    // Add days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(this.createDayData(d, today, false));
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push(this.createDayData(d, today, true));
    }

    // Add days from next month to complete grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.createDayData(d, today, false));
    }

    return days;
  });

  dayHoursData = computed(() => {
    const date = this.currentDate();
    const hours: HourSlot[] = [];

    for (let h = 0; h < 24; h++) { // 12 AM to 11 PM
      const hourJobs = this.jobs.filter(job => {
        const jobDate = new Date(job.date);
        return jobDate.toDateString() === date.toDateString() &&
          jobDate.getHours() === h;
      });

      hours.push({
        hour: h,
        label: this.formatHour(h),
        jobs: hourJobs
      });
    }

    return hours;
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      todayOutline
    });
  }

  ngOnInit(): void {
    this.currentView.set(this.initialView);
    this.emitDateChange();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialView'] && !changes['initialView'].firstChange) {
      this.currentView.set(this.initialView);
    }
  }

  onViewChange(event: CustomEvent): void {
    const view = event.detail.value as CalendarViewType;
    this.currentView.set(view);
    this.viewChange.emit(view);
    this.emitDateChange();
  }

  goToPrevious(): void {
    const date = this.currentDate();
    const view = this.currentView();

    if (view === 'day') {
      date.setDate(date.getDate() - 1);
    } else if (view === 'week') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setMonth(date.getMonth() - 1);
    }

    this.currentDate.set(new Date(date));
    this.emitDateChange();
  }

  goToNext(): void {
    const date = this.currentDate();
    const view = this.currentView();

    if (view === 'day') {
      date.setDate(date.getDate() + 1);
    } else if (view === 'week') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    this.currentDate.set(new Date(date));
    this.emitDateChange();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.emitDateChange();
  }

  selectDay(day: DayData): void {
    this.currentDate.set(new Date(day.date));
    if (this.currentView() !== 'day') {
      this.currentView.set('day');
      this.viewChange.emit('day');
    }
    this.emitDateChange();
  }

  onJobClick(job: CalendarJob, event?: Event): void {
    event?.stopPropagation();
    this.jobClick.emit(job);
  }

  getStatusColor(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.PENDING_ACCEPTANCE:
        return 'warning';
      case BookingStatus.CONFIRMED:
        return 'primary';
      case BookingStatus.ON_THE_WAY:
      case BookingStatus.ARRIVED:
        return 'tertiary';
      case BookingStatus.IN_PROGRESS:
        return 'secondary';
      case BookingStatus.COMPLETED:
      case BookingStatus.PAID:
        return 'success';
      case BookingStatus.CANCELLED:
      case BookingStatus.REJECTED:
        return 'danger';
      default:
        return 'medium';
    }
  }

  private createDayData(date: Date, today: Date, isCurrentMonth: boolean): DayData {
    date.setHours(0, 0, 0, 0);
    const dayJobs = this.jobs.filter(job => {
      const jobDate = new Date(job.date);
      jobDate.setHours(0, 0, 0, 0);
      return jobDate.getTime() === date.getTime();
    });

    return {
      date,
      dayNumber: date.getDate(),
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth,
      jobs: dayJobs
    };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  private emitDateChange(): void {
    const view = this.currentView();
    const date = this.currentDate();
    let start: Date;
    let end: Date;

    if (view === 'day') {
      start = new Date(date);
      start.setHours(0, 0, 0, 0);
      end = new Date(date);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      start = this.getWeekStart(date);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    this.dateChange.emit({ start, end });
  }
}
