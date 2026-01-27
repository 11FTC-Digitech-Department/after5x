import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonInput,
  IonDatetime,
  IonButton,
  IonSpinner,
  IonCheckbox,
  IonRadioGroup,
  IonRadio,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { ServiceService } from '../../../../core/services/service.service';

interface ServiceCategory {
  id: string;
  name: string;
  icon_url?: string;
}

@Component({
  selector: 'app-provider-application-form',
  templateUrl: './application-form.page.html',
  styleUrls: ['./application-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonDatetime,
    IonButton,
    IonSpinner,
    IonCheckbox,
    IonRadioGroup,
    IonRadio,
    IonText
  ]
})
export class ProviderApplicationFormPage implements OnInit {
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private serviceService = inject(ServiceService);
  private toastController = inject(ToastController);

  applicationForm!: FormGroup;
  categories = signal<ServiceCategory[]>([]);
  isSubmitting = signal<boolean>(false);
  isLoadingCategories = signal<boolean>(true);

  ngOnInit() {
    this.initializeForm();
    this.loadCategories();
  }

  private initializeForm() {
    // Calculate max date (18 years ago)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const maxDateString = maxDate.toISOString().split('T')[0];

    this.applicationForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^(\+639|09)\d{9}$/)]],
      dateOfBirth: ['', [Validators.required, this.ageValidator.bind(this)]],
      hasSmartphone: ['yes', Validators.required],
      yearsOfExperience: [0, [Validators.required, Validators.min(0)]],
      selectedCategories: [[], [Validators.required, this.arrayMinLengthValidator(1)]]
    });
  }

  // Custom validator for age (must be 18+)
  private ageValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null; // Let required validator handle empty values
    }

    const dob = new Date(control.value);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) 
      ? age - 1 
      : age;

    if (actualAge < 18) {
      return { ageTooYoung: { requiredAge: 18, actualAge } };
    }

    return null;
  }

  // Custom validator for array minimum length
  private arrayMinLengthValidator(minLength: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value || !Array.isArray(value) || value.length < minLength) {
        return { minLength: { requiredLength: minLength, actualLength: value?.length || 0 } };
      }
      return null;
    };
  }

  async loadCategories() {
    this.isLoadingCategories.set(true);
    try {
      const data = await this.serviceService.getServiceCategories();
      if (data && Array.isArray(data)) {
        this.categories.set(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      await this.showToast('Failed to load service categories', 'danger');
    } finally {
      this.isLoadingCategories.set(false);
    }
  }

  getFieldError(fieldName: string): string | null {
    const field = this.applicationForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return null;
    }

    const errors = field.errors;

    if (errors['required']) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }
    if (errors['email']) {
      return 'Invalid email format';
    }
    if (errors['minlength']) {
      return `${this.getFieldLabel(fieldName)} must be at least ${errors['minlength'].requiredLength} characters`;
    }
    if (errors['pattern']) {
      return 'Invalid phone number format. Use +639XXXXXXXXX or 09XXXXXXXXX';
    }
    if (errors['ageTooYoung']) {
      return `Must be at least 18 years old (currently ${errors['ageTooYoung'].actualAge})`;
    }
    if (errors['minLength']) {
      return `Please select at least ${errors['minLength'].requiredLength} specialization`;
    }
    if (errors['min']) {
      return 'Years of experience must be 0 or greater';
    }

    return null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.applicationForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      password: 'Password',
      mobileNumber: 'Mobile Number',
      dateOfBirth: 'Date of Birth',
      hasSmartphone: 'Smartphone ownership',
      yearsOfExperience: 'Years of Experience',
      selectedCategories: 'Specialization'
    };
    return labels[fieldName] || fieldName;
  }

  async onSubmit() {
    // Mark all fields as touched to show validation errors
    Object.keys(this.applicationForm.controls).forEach(key => {
      this.applicationForm.get(key)?.markAsTouched();
    });

    if (this.applicationForm.invalid) {
      await this.showToast('Please fix the errors in the form', 'warning');
      return;
    }

    // Check smartphone requirement
    if (this.applicationForm.value.hasSmartphone !== 'yes') {
      await this.showToast('Smartphone ownership is required to become a provider', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      // Call Edge Function
      const { data, error } = await this.supabaseService.client.functions.invoke(
        'create-provider-application',
        {
          body: {
            firstName: this.applicationForm.value.firstName,
            middleName: this.applicationForm.value.middleName || null,
            lastName: this.applicationForm.value.lastName,
            email: this.applicationForm.value.email,
            password: this.applicationForm.value.password,
            mobileNumber: this.applicationForm.value.mobileNumber,
            dateOfBirth: this.applicationForm.value.dateOfBirth,
            hasSmartphone: this.applicationForm.value.hasSmartphone === 'yes',
            yearsOfExperience: parseInt(this.applicationForm.value.yearsOfExperience, 10),
            selectedCategories: this.applicationForm.value.selectedCategories
          }
        }
      );

      if (error) {
        console.error('Edge Function error:', error);
        await this.showToast(error.message || 'Failed to submit application', 'danger');
        return;
      }

      if (data?.error) {
        await this.showToast(data.error, 'danger');
        return;
      }

      // Success - redirect to OTP verification
      await this.showToast('Application submitted! Please verify your email', 'success');
      this.router.navigate(['/auth/verify-otp'], {
        queryParams: {
          email: this.applicationForm.value.email,
          type: 'signup'
        }
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      await this.showToast('An unexpected error occurred. Please try again', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  getMaxDate(): string {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return maxDate.toISOString().split('T')[0];
  }

  isCategorySelected(categoryId: string): boolean {
    const selected = this.applicationForm.get('selectedCategories')?.value || [];
    return selected.includes(categoryId);
  }

  toggleCategory(categoryId: string) {
    const control = this.applicationForm.get('selectedCategories');
    if (!control) return;

    const currentValue: string[] = control.value || [];
    const index = currentValue.indexOf(categoryId);

    if (index > -1) {
      // Remove category
      currentValue.splice(index, 1);
    } else {
      // Add category
      currentValue.push(categoryId);
    }

    control.setValue([...currentValue]);
    control.markAsTouched();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
