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
import { MapSelectorComponent } from '../map-selector/map-selector.component';
import { AddressService } from '../../supabase/address.service';
import { UserAddress, CreateAddressRequest, UpdateAddressRequest, GeocodeResult } from '../../models/address.model';

@Component({
  selector: 'app-address-form',
  templateUrl: './address-form.component.html',
  styleUrls: ['./address-form.component.scss'],
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
    IonSpinner,
    MapSelectorComponent
  ]
})
export class AddressFormComponent implements OnInit {
  private modalController = inject(ModalController);
  private formBuilder = inject(FormBuilder);
  private addressService = inject(AddressService);
  private toastController = inject(ToastController);

  // Component inputs (passed via modal props)
  address: UserAddress | null = null;
  isEditMode = computed(() => !!this.address);

  // Form
  addressForm!: FormGroup;
  isSubmitting = signal(false);

  // Location data
  selectedLocation = signal<GeocodeResult | null>(null);

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
    const existingAddress = this.address;

    this.addressForm = this.formBuilder.group({
      label: [existingAddress?.label || 'Home', [Validators.required]],
      is_default: [existingAddress?.is_default || false],
      full_address: [existingAddress?.full_address || '', [Validators.required]],
      unit_details: [existingAddress?.unit_details || ''],
      access_instructions: [existingAddress?.access_instructions || ''],
      has_parking: [existingAddress?.has_parking || false],
      parking_instructions: [existingAddress?.parking_instructions || '']
    });

    // Set initial location if editing
    if (existingAddress) {
      this.selectedLocation.set({
        lat: existingAddress.location.lat,
        lng: existingAddress.location.lng,
        address: existingAddress.full_address
      });
    }
  }

  onLocationSelected(location: GeocodeResult) {
    this.selectedLocation.set(location);
    // Update the address field with the selected location's address
    this.addressForm.patchValue({
      full_address: location.address
    });
  }

  async onSubmit() {
    if (this.addressForm.invalid || !this.selectedLocation()) {
      this.showToast('Please fill in all required fields and select a location', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const formValue = this.addressForm.value;
      const location = this.selectedLocation()!;

      if (this.isEditMode()) {
        // Update existing address
        const updateRequest: UpdateAddressRequest = {
          id: this.address!.id,
          label: formValue.label,
          is_default: formValue.is_default,
          full_address: formValue.full_address,
          unit_details: formValue.unit_details,
          access_instructions: formValue.access_instructions,
          has_parking: formValue.has_parking,
          parking_instructions: formValue.parking_instructions,
          latitude: location.lat,
          longitude: location.lng
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
          full_address: formValue.full_address,
          unit_details: formValue.unit_details,
          access_instructions: formValue.access_instructions,
          has_parking: formValue.has_parking,
          parking_instructions: formValue.parking_instructions,
          latitude: location.lat,
          longitude: location.lng
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

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
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