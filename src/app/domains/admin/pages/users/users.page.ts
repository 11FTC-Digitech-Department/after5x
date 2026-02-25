import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonAvatar,
  IonBadge,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  ActionSheetController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { ellipsisHorizontalOutline, personOutline } from 'ionicons/icons';
import { AdminService, AdminUser } from '../../../../core/services/admin.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonAvatar,
    IonBadge,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class UsersPage implements OnInit {
  private adminService = inject(AdminService);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  users = signal<AdminUser[]>([]);
  isLoading = signal(false);
  searchQuery = signal('');
  selectedRole = signal('');
  page = 0;
  hasMore = true;

  constructor() {
    addIcons({ ellipsisHorizontalOutline, personOutline });
  }

  ngOnInit() {
    this.loadUsers(true);
  }

  async loadUsers(reset = false) {
    if (reset) {
      this.page = 0;
      this.hasMore = true;
      this.users.set([]);
    }
    if (!this.hasMore) return;

    this.isLoading.set(true);
    try {
      const result = await this.adminService.getUsers({
        page: this.page,
        pageSize: 20,
        search: this.searchQuery() || undefined,
        role: this.selectedRole() || undefined,
      });
      if (result.length < 20) this.hasMore = false;
      this.users.update((prev) => [...prev, ...result]);
      this.page++;
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to load users', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    await this.loadUsers(true);
    event.target.complete();
  }

  async onInfiniteScroll(event: any) {
    await this.loadUsers();
    event.target.complete();
  }

  onSearchChange(ev: any) {
    this.searchQuery.set(ev.detail.value || '');
    this.loadUsers(true);
  }

  onRoleFilter(ev: any) {
    this.selectedRole.set(ev.detail.value || '');
    this.loadUsers(true);
  }

  async openActions(user: AdminUser) {
    const buttons: any[] = [
      {
        text: 'Change Role',
        handler: () => this.promptChangeRole(user),
      },
      {
        text: user.activated ? 'Deactivate Account' : 'Activate Account',
        role: user.activated ? 'destructive' : undefined,
        handler: () => this.toggleActivation(user),
      },
      { text: 'Cancel', role: 'cancel' },
    ];

    const sheet = await this.actionSheetCtrl.create({
      header: user.full_name,
      buttons,
    });
    await sheet.present();
  }

  async promptChangeRole(user: AdminUser) {
    const alert = await this.alertCtrl.create({
      header: 'Change Role',
      inputs: [
        { type: 'radio', label: 'Customer', value: 'customer', checked: user.role === 'customer' },
        { type: 'radio', label: 'Provider', value: 'provider', checked: user.role === 'provider' },
        { type: 'radio', label: 'Admin', value: 'admin', checked: user.role === 'admin' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (role: 'customer' | 'provider' | 'admin') => {
            if (!role || role === user.role) return;
            try {
              await this.adminService.updateUserRole(user.id, role);
              this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role } : u)));
              await this.showToast(`Role updated to ${role}`);
            } catch (e: any) {
              await this.showToast(e.message || 'Failed to update role', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async toggleActivation(user: AdminUser) {
    const newVal = !user.activated;
    try {
      await this.adminService.setUserActivated(user.id, newVal);
      this.users.update((list) =>
        list.map((u) => (u.id === user.id ? { ...u, activated: newVal } : u))
      );
      await this.showToast(newVal ? 'Account activated' : 'Account deactivated');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to update activation', 'danger');
    }
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'admin': return 'danger';
      case 'provider': return 'primary';
      default: return 'medium';
    }
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}
