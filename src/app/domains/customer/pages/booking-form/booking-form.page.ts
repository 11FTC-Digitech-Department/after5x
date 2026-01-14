import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonCardHeader,
  IonText,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonDatetime,
  IonSelect,
  IonSelectOption,
  IonList,
  IonChip,
  IonProgressBar,
  IonSpinner
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface BookingDetails {
  serviceType: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  preferredDateTime: string;
  address: string;
  contactNumber: string;
  specialInstructions?: string;
}

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

interface PriceBreakdown {
  baseService: number;
  urgencyFee: number;
  mediaProcessing: number;
  total: number;
}

@Component({
  selector: 'app-booking-form',
  templateUrl: './booking-form.page.html',
  styleUrls: ['./booking-form.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonText,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonList,
    IonChip,
    IonProgressBar,
    IonSpinner,
    CommonModule,
    ReactiveFormsModule
  ]
})
export class BookingFormPage implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  // Step management
  currentStep = signal<1 | 2>(1);
  isLoading = signal(false);

  // Form
  bookingForm!: FormGroup;

  // Media files
  mediaFiles = signal<MediaFile[]>([]);
  isUploading = signal(false);

  // Price calculations
  priceBreakdown = computed((): PriceBreakdown => {
    const baseService = 1200; // Base service fee
    const urgencyFee = this.calculateUrgencyFee();
    const mediaProcessing = this.mediaFiles().length * 100; // ₱100 per media file
    const total = baseService + urgencyFee + mediaProcessing;

    return {
      baseService,
      urgencyFee,
      mediaProcessing,
      total
    };
  });

  // Computed values for template
  selectedServiceLabel = computed(() => {
    const serviceType = this.bookingForm?.get('serviceType')?.value;
    return this.serviceTypes.find(s => s.value === serviceType)?.label || '';
  });

  selectedUrgencyLabel = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    return this.urgencyLevels.find(u => u.value === urgency)?.label || '';
  });

  selectedUrgencyColor = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    return this.urgencyLevels.find(u => u.value === urgency)?.color || 'primary';
  });

  // Service types
  serviceTypes = [
    { value: 'locksmithing', label: 'Locksmithing', icon: 'key' },
    { value: 'aircon', label: 'Air Conditioning', icon: 'snow' },
    { value: 'electrical', label: 'Electrical', icon: 'flash' },
    { value: 'automotive', label: 'Automotive', icon: 'car' },
    { value: 'plumbing', label: 'Plumbing', icon: 'water' },
    { value: 'other', label: 'Other', icon: 'construct' }
  ];

  // Urgency levels
  urgencyLevels = [
    { value: 'low', label: 'Low - Within 24 hours', color: 'success' },
    { value: 'medium', label: 'Medium - Within 12 hours', color: 'warning' },
    { value: 'high', label: 'High - Within 6 hours', color: 'danger' },
    { value: 'emergency', label: 'Emergency - ASAP', color: 'danger' }
  ];

  constructor() {
    this.initializeForm();
  }

  ngOnInit() {
  }

  private initializeForm() {
    this.bookingForm = this.formBuilder.group({
      serviceType: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      urgency: ['low', Validators.required],
      preferredDateTime: ['', Validators.required],
      address: ['', Validators.required],
      contactNumber: ['', [Validators.required, Validators.pattern(/^(\+63|0)[9]\d{9}$/)]],
      specialInstructions: ['']
    });
  }

  private calculateUrgencyFee(): number {
    const urgency = this.bookingForm?.get('urgency')?.value;
    switch (urgency) {
      case 'low': return 0;
      case 'medium': return 300;
      case 'high': return 600;
      case 'emergency': return 1000;
      default: return 0;
    }
  }

  // Navigation methods
  nextStep() {
    if (this.bookingForm.valid && this.currentStep() === 1) {
      this.currentStep.set(2);
    }
  }

  previousStep() {
    if (this.currentStep() === 2) {
      this.currentStep.set(1);
    }
  }

  // Camera and file methods
  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: true
      });

      if (image.webPath) {
        await this.addMediaFileFromUri(image.webPath, 'image', `photo_${Date.now()}.jpg`);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  }

  async selectFromGallery() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });

      if (image.webPath) {
        await this.addMediaFileFromUri(image.webPath, 'image', `gallery_${Date.now()}.jpg`);
      }
    } catch (error) {
      console.error('Error selecting from gallery:', error);
    }
  }

  private async addMediaFileFromUri(uri: string, type: 'image' | 'video', name: string) {
    try {
      // Convert URI to File object
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], name, { type: blob.type });

      const mediaFile: MediaFile = {
        id: Date.now().toString(),
        file,
        preview: uri,
        type,
        name,
        size: file.size
      };

      this.mediaFiles.update(files => [...files, mediaFile]);
    } catch (error) {
      console.error('Error adding media file:', error);
    }
  }

  removeMediaFile(fileId: string) {
    this.mediaFiles.update(files => files.filter(f => f.id !== fileId));
  }


  // Submit booking
  async submitBooking() {
    if (this.bookingForm.valid) {
      this.isLoading.set(true);

      try {
        const bookingData = {
          ...this.bookingForm.value,
          mediaFiles: this.mediaFiles(),
          priceBreakdown: this.priceBreakdown()
        };

        console.log('Submitting booking:', bookingData);

        // Here you would typically call a service to submit the booking
        // For now, just simulate success
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Navigate to success page or booking confirmation
        this.router.navigate(['/c/bookings']);
      } catch (error) {
        console.error('Error submitting booking:', error);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getUrgencyColor(urgency: string): string {
    return this.urgencyLevels.find(level => level.value === urgency)?.color || 'primary';
  }

  getServiceIcon(serviceType: string): string {
    return this.serviceTypes.find(service => service.value === serviceType)?.icon || 'construct';
  }
}
