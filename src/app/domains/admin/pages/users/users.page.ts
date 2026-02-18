import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonAvatar, IonBadge,
  IonSearchbar, IonSegment, IonSegmentButton,
  IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
  IonIcon, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline } from 'ionicons/icons';
import { AdminService, AdminUser } from '../../../../core/services/admin.service';
import { devError } from '../../../../core/utils/logger';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonList, IonItem, IonLabel, IonAvatar, IonBadge,
    IonSearchbar, IonSegment, IonSegmentButton,
    IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
    IonIcon, IonRefresher, IonRefresherContent,
    CommonModule, FormsModule
  ]
})
export class UsersPage implements OnInit {
  private adminService = inject(AdminService);

  users = signal<AdminUser[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  currentPage = signal(1);
  roleFilter = signal<string>('');
  searchQuery = signal('');

  private pageSize = 20;

  constructor() {
    addIcons({ personOutline });
  }

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers(append = false) {
    if (!append) {
      this.loading.set(true);
      this.currentPage.set(1);
    }
    try {
      const result = await this.adminService.getUsers(
        this.currentPage(),
        this.pageSize,
        this.roleFilter() || undefined,
        this.searchQuery() || undefined
      );
      if (append) {
        this.users.update(existing => [...existing, ...result.data]);
      } else {
        this.users.set(result.data);
      }
      this.totalCount.set(result.count);
    } catch (err) {
      devError('Failed to load users:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async onRoleChange(event: any) {
    this.roleFilter.set(event.detail.value || '');
    await this.loadUsers();
  }

  async onSearch(event: any) {
    this.searchQuery.set(event.detail.value || '');
    await this.loadUsers();
  }

  async loadMore(event: any) {
    this.currentPage.update(p => p + 1);
    await this.loadUsers(true);
    event.target.complete();
    if (this.users().length >= this.totalCount()) {
      event.target.disabled = true;
    }
  }

  async handleRefresh(event: any) {
    await this.loadUsers();
    event.target.complete();
  }

  getRoleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      admin: 'danger',
      provider: 'primary',
      customer: 'success',
      agency_admin: 'warning',
    };
    return colors[role] || 'medium';
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  }
}
