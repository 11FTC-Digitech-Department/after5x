import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonText,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController
} from '@ionic/angular/standalone';
import { AddressService } from '../../supabase/address.service';
import { UserAddress, CreateAddressRequest, UpdateAddressRequest, GeocodeResult } from '../../models/address.model';

@Component({
  selector: 'app-address-details-form',
  templateUrl: './address-details-form.component.html',
  styleUrls: ['./address-details-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonText,
    IonIcon,
    IonSpinner
  ]
})
export class AddressDetailsFormComponent implements OnInit {
  private modalController = inject(ModalController);
  private formBuilder = inject(FormBuilder);
  private addressService = inject(AddressService);
  private toastController = inject(ToastController);

  // Component inputs (passed via modal props)
  location!: GeocodeResult; // Required - the selected location from the map
  existingAddress: UserAddress | null = null; // Optional - for edit mode

  // Computed
  isEditMode = computed(() => !!this.existingAddress);

  // Form
  addressForm!: FormGroup;
  isSubmitting = signal(false);

  // Address labels
  addressLabels = [
    'Home',
    'Work',
    'School',
    'Gym',
    'Restaurant',
    'Park',
    'Hospital',
    'Mall',
    'Airport',
    'Other'
  ];

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    const existing = this.existingAddress;

    this.addressForm = this.formBuilder.group({
      label: [existing?.label || 'Home', [Validators.required]],
      is_default: [existing?.is_default || false],
      unit_details: [existing?.unit_details || ''],
      access_instructions: [existing?.access_instructions || ''],
      has_parking: [existing?.has_parking || false],
      parking_instructions: [existing?.parking_instructions || '']
    });
  }

  async onSubmit() {
    if (this.addressForm.invalid) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    // Validate the location
    if (!this.location || (this.location.lat === 0 && this.location.lng === 0)) {
      this.showToast('Invalid location. Please select a valid location.', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const formValue = this.addressForm.value;

      if (this.isEditMode()) {
        // Update existing address
        const updateRequest: UpdateAddressRequest = {
          id: this.existingAddress!.id,
          label: formValue.label,
          is_default: formValue.is_default,
          full_address: this.location.address,
          unit_details: formValue.unit_details,
          access_instructions: formValue.access_instructions,
          has_parking: formValue.has_parking,
          parking_instructions: formValue.parking_instructions,
          latitude: this.location.lat,
          longitude: this.location.lng
        };

        const result = await this.addressService.updateAddress(updateRequest);

        if (result.error) {
          this.showToast('Failed to update address: ' + result.error, 'danger');
        } else {
          this.showToast('Address updated successfully', 'success');
          await this.modalController.dismiss(result.data, 'save');
        }
      } else {
        // Create new address
        const createRequest: CreateAddressRequest = {
          label: formValue.label,
          is_default: formValue.is_default,
          full_address: this.location.address,
          unit_details: formValue.unit_details,
          access_instructions: formValue.access_instructions,
          has_parking: formValue.has_parking,
          parking_instructions: formValue.parking_instructions,
          latitude: this.location.lat,
          longitude: this.location.lng
        };

        const result = await this.addressService.createAddress(createRequest);

        if (result.error) {
          this.showToast('Failed to create address: ' + result.error, 'danger');
        } else {
          this.showToast('Address created successfully', 'success');
          await this.modalController.dismiss(result.data, 'save');
        }
      }
    } catch (error) {
      this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async onCancel() {
    await this.modalController.dismiss(null, 'cancel');
  }

  async changeLocation() {
    // Dismiss modal with special role to trigger navigation to map
    await this.modalController.dismiss(null, 'change-location');
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  // Form validation helpers
  getFieldError(fieldName: string): string | null {
    const field = this.addressForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
    }
    return null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.addressForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
