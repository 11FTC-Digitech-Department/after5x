import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonList,
  IonInput,
  IonTextarea,
  IonToggle,
  IonNote,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  pencilOutline,
  trashOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import {
  AdminService,
  AdminCatalogCategory,
  AdminCatalogService,
  AdminCatalogVariant,
} from '../../../../core/services/admin.service';

type CategoryForm = {
  name: string;
  description: string;
  icon_url: string;
  sort_order: number;
  is_active: boolean;
};

type ServiceForm = {
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

type VariantForm = {
  name: string;
  price_min: number;
  price_max: number;
  price_after5_min: number;
  price_after5_max: number;
  duration_minutes: number;
  commission_rate: number;
  vat_rate: number;
  is_active: boolean;
};

@Component({
  selector: 'app-services',
  templateUrl: './services.page.html',
  styleUrls: ['./services.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
    IonBadge,
    IonButton,
    IonButtons,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonList,
    IonInput,
    IonTextarea,
    IonToggle,
    IonNote,
  ],
})
export class ServicesPage implements OnInit {
  private adminService = inject(AdminService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  catalog = signal<AdminCatalogCategory[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);

  // Category modal
  showCategoryModal = signal(false);
  editingCategory = signal<AdminCatalogCategory | null>(null);
  categoryForm = signal<CategoryForm>({
    name: '', description: '', icon_url: '', sort_order: 0, is_active: true,
  });

  // Service modal
  showServiceModal = signal(false);
  editingService = signal<AdminCatalogService | null>(null);
  serviceModalParentCategoryId = signal<string | null>(null);
  serviceForm = signal<ServiceForm>({
    name: '', description: '', sort_order: 0, is_active: true,
  });

  // Variant modal
  showVariantModal = signal(false);
  editingVariant = signal<AdminCatalogVariant | null>(null);
  variantModalParentServiceId = signal<string | null>(null);
  variantForm = signal<VariantForm>({
    name: '', price_min: 0, price_max: 0, price_after5_min: 0, price_after5_max: 0,
    duration_minutes: 60, commission_rate: 0.15, vat_rate: 0.12, is_active: true,
  });

  constructor() {
    addIcons({ addOutline, pencilOutline, trashOutline, chevronDownOutline });
  }

  ngOnInit() {
    this.loadCatalog();
  }

  async loadCatalog() {
    this.isLoading.set(true);
    try {
      const data = await this.adminService.getCatalog();
      this.catalog.set(data);
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to load catalog', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    await this.loadCatalog();
    event.target.complete();
  }

  // --- Category CRUD ---

  openAddCategory() {
    this.editingCategory.set(null);
    this.categoryForm.set({ name: '', description: '', icon_url: '', sort_order: 0, is_active: true });
    this.showCategoryModal.set(true);
  }

  openEditCategory(cat: AdminCatalogCategory, event: Event) {
    event.stopPropagation();
    this.editingCategory.set(cat);
    this.categoryForm.set({
      name: cat.name,
      description: cat.description || '',
      icon_url: cat.icon_url || '',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    this.showCategoryModal.set(true);
  }

  async saveCategory() {
    const form = this.categoryForm();
    if (!form.name.trim()) {
      await this.showToast('Name is required', 'warning');
      return;
    }
    this.isSaving.set(true);
    try {
      const editing = this.editingCategory();
      if (editing) {
        await this.adminService.updateCategory(editing.id, form);
        this.catalog.update((cats) =>
          cats.map((c) => c.id === editing.id ? { ...c, ...form } : c)
        );
      } else {
        await this.adminService.createCategory(form);
        await this.loadCatalog();
      }
      this.showCategoryModal.set(false);
      await this.showToast('Category saved');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to save', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteCategory(cat: AdminCatalogCategory, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Category?',
      message: `Delete "${cat.name}"? This may also affect its services.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.deleteCategory(cat.id);
              this.catalog.update((cats) => cats.filter((c) => c.id !== cat.id));
              await this.showToast('Category deleted');
            } catch (e: any) {
              await this.showToast(e.message || 'Failed to delete', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // --- Service CRUD ---

  openAddService(categoryId: string) {
    this.editingService.set(null);
    this.serviceModalParentCategoryId.set(categoryId);
    this.serviceForm.set({ name: '', description: '', sort_order: 0, is_active: true });
    this.showServiceModal.set(true);
  }

  openEditService(svc: AdminCatalogService, event: Event) {
    event.stopPropagation();
    this.editingService.set(svc);
    this.serviceModalParentCategoryId.set(svc.category_id);
    this.serviceForm.set({
      name: svc.name,
      description: svc.description || '',
      sort_order: svc.sort_order,
      is_active: svc.is_active,
    });
    this.showServiceModal.set(true);
  }

  async saveService() {
    const form = this.serviceForm();
    if (!form.name.trim()) {
      await this.showToast('Name is required', 'warning');
      return;
    }
    this.isSaving.set(true);
    try {
      const editing = this.editingService();
      if (editing) {
        await this.adminService.updateService(editing.id, form);
        this.catalog.update((cats) =>
          cats.map((c) => ({
            ...c,
            services: (c.services || []).map((s) =>
              s.id === editing.id ? { ...s, ...form } : s
            ),
          }))
        );
      } else {
        await this.adminService.createService({
          ...form,
          category_id: this.serviceModalParentCategoryId()!,
        });
        await this.loadCatalog();
      }
      this.showServiceModal.set(false);
      await this.showToast('Service saved');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to save', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteService(svc: AdminCatalogService, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Service?',
      message: `Delete "${svc.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.deleteService(svc.id);
              this.catalog.update((cats) =>
                cats.map((c) => ({
                  ...c,
                  services: (c.services || []).filter((s) => s.id !== svc.id),
                }))
              );
              await this.showToast('Service deleted');
            } catch (e: any) {
              await this.showToast(e.message || 'Failed to delete', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // --- Variant CRUD ---

  openAddVariant(serviceId: string) {
    this.editingVariant.set(null);
    this.variantModalParentServiceId.set(serviceId);
    this.variantForm.set({
      name: '', price_min: 0, price_max: 0, price_after5_min: 0, price_after5_max: 0,
      duration_minutes: 60, commission_rate: 0.15, vat_rate: 0.12, is_active: true,
    });
    this.showVariantModal.set(true);
  }

  openEditVariant(variant: AdminCatalogVariant, event: Event) {
    event.stopPropagation();
    this.editingVariant.set(variant);
    this.variantModalParentServiceId.set(variant.service_id);
    this.variantForm.set({
      name: variant.name,
      price_min: variant.price_min,
      price_max: variant.price_max,
      price_after5_min: variant.price_after5_min,
      price_after5_max: variant.price_after5_max,
      duration_minutes: variant.duration_minutes,
      commission_rate: variant.commission_rate,
      vat_rate: variant.vat_rate,
      is_active: variant.is_active,
    });
    this.showVariantModal.set(true);
  }

  async saveVariant() {
    const form = this.variantForm();
    if (!form.name.trim()) {
      await this.showToast('Name is required', 'warning');
      return;
    }
    this.isSaving.set(true);
    try {
      const editing = this.editingVariant();
      if (editing) {
        await this.adminService.updateVariant(editing.id, form);
        this.catalog.update((cats) =>
          cats.map((c) => ({
            ...c,
            services: (c.services || []).map((s) => ({
              ...s,
              variants: (s.variants || []).map((v) =>
                v.id === editing.id ? { ...v, ...form } : v
              ),
            })),
          }))
        );
      } else {
        await this.adminService.createVariant({
          ...form,
          service_id: this.variantModalParentServiceId()!,
        });
        await this.loadCatalog();
      }
      this.showVariantModal.set(false);
      await this.showToast('Variant saved');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to save', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteVariant(variant: AdminCatalogVariant, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Variant?',
      message: `Delete "${variant.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.deleteVariant(variant.id);
              this.catalog.update((cats) =>
                cats.map((c) => ({
                  ...c,
                  services: (c.services || []).map((s) => ({
                    ...s,
                    variants: (s.variants || []).filter((v) => v.id !== variant.id),
                  })),
                }))
              );
              await this.showToast('Variant deleted');
            } catch (e: any) {
              await this.showToast(e.message || 'Failed to delete', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // Helpers for ngModel on signal-backed form fields
  getCategoryField<K extends keyof CategoryForm>(key: K): CategoryForm[K] {
    return this.categoryForm()[key];
  }

  setCategoryField<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    this.categoryForm.update((f) => ({ ...f, [key]: value }));
  }

  getServiceField<K extends keyof ServiceForm>(key: K): ServiceForm[K] {
    return this.serviceForm()[key];
  }

  setServiceField<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
    this.serviceForm.update((f) => ({ ...f, [key]: value }));
  }

  getVariantField<K extends keyof VariantForm>(key: K): VariantForm[K] {
    return this.variantForm()[key];
  }

  setVariantField<K extends keyof VariantForm>(key: K, value: VariantForm[K]) {
    this.variantForm.update((f) => ({ ...f, [key]: value }));
  }

  private async showToast(message: string, color = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}
