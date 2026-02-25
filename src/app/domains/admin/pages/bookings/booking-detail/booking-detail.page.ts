import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonBadge,
  IonList,
  IonListHeader,
  IonSpinner,
  IonButton,
  IonFooter,
  IonIcon,
  IonNote,
  ActionSheetController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { personOutline, timeOutline, locationOutline } from 'ionicons/icons';
import { AdminService, AdminBookingDetail } from '../../../../../core/services/admin.service';

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.page.html',
  styleUrls: ['./booking-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonBadge,
    IonList,
    IonListHeader,
    IonSpinner,
    IonButton,
    IonFooter,
    IonIcon,
    IonNote,
  ],
})
export class BookingDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private adminService = inject(AdminService);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  booking = signal<AdminBookingDetail | null>(null);
  isLoading = signal(false);
  bookingId = '';

  constructor() {
    addIcons({ personOutline, timeOutline, locationOutline });
  }

  ngOnInit() {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') || '';
    this.loadBooking();
  }

  async loadBooking() {
    if (!this.bookingId) return;
    this.isLoading.set(true);
    try {
      const detail = await this.adminService.getBookingDetail(this.bookingId);
      this.booking.set(detail);
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to load booking', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async openStatusChange() {
    const b = this.booking();
    if (!b) return;

    const terminalStatuses = ['completed', 'cancelled', 'rejected', 'expired'];
    const isTerminal = terminalStatuses.includes(b.status);

    const buttons: any[] = [];

    if (!isTerminal) {
      buttons.push({
        text: 'Mark Cancelled',
        role: 'destructive',
        handler: () => this.confirmCancel(b),
      });
    }

    if (['in_progress', 'payment_pending', 'paid'].includes(b.status)) {
      buttons.push({
        text: 'Mark Completed',
        handler: () => this.updateStatus('completed'),
      });
    }

    if (['pending_acceptance', 'confirmed'].includes(b.status)) {
      buttons.push({
        text: 'Force Reassign (Finding Provider)',
        handler: () => this.updateStatus('finding_provider'),
      });
    }

    if (!isTerminal) {
      buttons.push({
        text: 'Reset to Confirmed',
        handler: () => this.updateStatus('confirmed'),
      });
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: `Change Status (current: ${b.status})`,
      buttons,
    });
    await sheet.present();
  }

  async confirmCancel(booking: AdminBookingDetail) {
    const alert = await this.alertCtrl.create({
      header: 'Cancel Booking',
      message: 'Provide a cancellation reason (optional):',
      inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Reason...' }],
      buttons: [
        { text: 'Back', role: 'cancel' },
        {
          text: 'Cancel Booking',
          role: 'destructive',
          handler: async (data: { reason: string }) => {
            await this.updateStatus('cancelled', data.reason);
          },
        },
      ],
    });
    await alert.present();
  }

  async updateStatus(status: string, reason?: string) {
    try {
      await this.adminService.updateBookingStatus(this.bookingId, status, reason);
      this.booking.update((b) => b ? { ...b, status, cancellation_reason: reason ?? b.cancellation_reason } : b);
      await this.showToast(`Status updated to ${status}`);
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to update status', 'danger');
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'success';
      case 'cancelled':
      case 'rejected':
      case 'expired': return 'danger';
      case 'in_progress':
      case 'on_the_way':
      case 'arrived': return 'primary';
      case 'confirmed': return 'secondary';
      case 'pending_acceptance':
      case 'finding_provider': return 'warning';
      case 'paid':
      case 'payment_pending': return 'tertiary';
      default: return 'medium';
    }
  }

  private async showToast(message: string, color = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}
