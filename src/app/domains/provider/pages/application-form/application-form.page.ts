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
  IonItem,
  IonLabel,
  IonInput,
  IonDatetime,
  IonButton,
  IonSpinner,
  IonRadioGroup,
  IonRadio,
  IonText,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { ServiceService } from '../../../../core/services/service.service';
import { SignupSuccessModalComponent } from '../../../../shared/components/signup-success-modal/signup-success-modal.component';
import { devLog } from '../../../../core/utils/logger';

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
    IonItem,
    IonLabel,
    IonInput,
    IonDatetime,
    IonButton,
    IonSpinner,
    IonRadioGroup,
    IonRadio,
    IonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonIcon,
    SignupSuccessModalComponent
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
  showSuccessModal = signal<boolean>(false);

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
      email: ['', [Validators.required, Validators.email, this.emailValidator.bind(this)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^(\+63|0)[9]\d{9}$/)]],
      dateOfBirth: ['', [Validators.required, this.ageValidator.bind(this)]],
      hasSmartphone: ['yes', Validators.required],
      yearsOfExperience: [0, [Validators.required, Validators.min(0)]],
      selectedCategories: [[], [Validators.required, this.arrayMinLengthValidator(1)]]
    });
  }

  // Custom validator for email format (more strict than Angular's default)
  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null; // Let required validator handle empty values
    }

    const email = control.value.trim().toLowerCase();
    // RFC 5322 compliant email regex (simplified but more strict than Angular's default)
    const emailPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    
    if (!emailPattern.test(email)) {
      return { invalidEmailFormat: true };
    }

    // Additional checks
    if (email.length > 254) {
      return { emailTooLong: true };
    }

    return null;
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
    if (errors['email'] || errors['invalidEmailFormat']) {
      return 'Invalid email format. Please enter a valid email address';
    }
    if (errors['emailTooLong']) {
      return 'Email address is too long (maximum 254 characters)';
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
    if (errors['serverError']) {
      return typeof errors['serverError'] === 'string' 
        ? errors['serverError'] 
        : 'This value is already in use. Please try a different one.';
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
    // Prevent double submit (e.g. form + button or double click)
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);

    // Mark all fields as touched to show validation errors
    Object.keys(this.applicationForm.controls).forEach(key => {
      this.applicationForm.get(key)?.markAsTouched();
    });

    if (this.applicationForm.invalid) {
      this.isSubmitting.set(false);
      await this.showToast('Please fix the errors in the form', 'warning');
      return;
    }

    // Check smartphone requirement
    if (this.applicationForm.value.hasSmartphone !== 'yes') {
      this.isSubmitting.set(false);
      await this.showToast('Smartphone ownership is required to become a provider', 'warning');
      return;
    }

    try {
      // Additional client-side validation before submission
      const email = this.applicationForm.value.email?.trim().toLowerCase();
      const mobileNumber = this.applicationForm.value.mobileNumber?.trim();

      // Validate email format (double-check)
      if (!email || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(email)) {
        this.applicationForm.get('email')?.setErrors({ invalidEmailFormat: true });
        this.applicationForm.get('email')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('Please enter a valid email address', 'warning');
        return;
      }

      // Validate mobile number format (double-check)
      if (!mobileNumber || !/^(\+63|0)[9]\d{9}$/.test(mobileNumber)) {
        this.applicationForm.get('mobileNumber')?.setErrors({ pattern: true });
        this.applicationForm.get('mobileNumber')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('Invalid phone number format. Use +639XXXXXXXXX or 09XXXXXXXXX', 'warning');
        return;
      }

      // Check if email already exists in database
      devLog('[Provider Signup] Checking if email already exists...');
      const { data: existingEmailProfile } = await this.supabaseService.client
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingEmailProfile) {
        this.applicationForm.get('email')?.setErrors({ 
          serverError: 'This email address is already registered. Please use a different email or try signing in.' 
        });
        this.applicationForm.get('email')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('This email address is already registered. Please use a different email or try signing in.', 'danger');
        return;
      }

      // Check if mobile number already exists in database
      devLog('[Provider Signup] Checking if mobile number already exists...');
      const normalizedMobile = mobileNumber.replace(/\s+/g, '');
      const { data: existingPhoneProfile } = await this.supabaseService.client
        .from('profiles')
        .select('id, phone_number')
        .eq('phone_number', normalizedMobile)
        .maybeSingle();

      if (existingPhoneProfile) {
        this.applicationForm.get('mobileNumber')?.setErrors({ 
          serverError: 'This mobile number is already registered. Please use a different mobile number or try signing in.' 
        });
        this.applicationForm.get('mobileNumber')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('This mobile number is already registered. Please use a different mobile number or try signing in.', 'danger');
        return;
      }

      // Format date of birth to YYYY-MM-DD if it's an ISO string
      let dateOfBirth = this.applicationForm.value.dateOfBirth;
      if (!dateOfBirth) {
        this.applicationForm.get('dateOfBirth')?.setErrors({ required: true });
        this.applicationForm.get('dateOfBirth')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('Date of birth is required', 'warning');
        return;
      }
      if (dateOfBirth && dateOfBirth.includes('T')) {
        dateOfBirth = dateOfBirth.split('T')[0];
      }

      // Validate selected categories
      const selectedCategories = this.applicationForm.value.selectedCategories;
      if (!selectedCategories || !Array.isArray(selectedCategories) || selectedCategories.length === 0) {
        this.applicationForm.get('selectedCategories')?.setErrors({ required: true });
        this.applicationForm.get('selectedCategories')?.markAsTouched();
        this.isSubmitting.set(false);
        await this.showToast('Please select at least one specialization', 'warning');
        return;
      }

      // Call Edge Function to create user and provider records
      // Edge Function will handle user creation, profile creation, provider setup, and email verification
      devLog('[Provider Signup] Calling Edge Function to create provider application...');

      const response = await this.supabaseService.client.functions.invoke(
        'create-provider-application',
        {
          body: {
            email: email,
            password: this.applicationForm.value.password,
            firstName: this.applicationForm.value.firstName.trim(),
            middleName: this.applicationForm.value.middleName?.trim() || null,
            lastName: this.applicationForm.value.lastName.trim(),
            mobileNumber: mobileNumber,
            dateOfBirth: dateOfBirth,
            hasSmartphone: this.applicationForm.value.hasSmartphone === 'yes',
            yearsOfExperience: parseInt(this.applicationForm.value.yearsOfExperience, 10),
            selectedCategories: selectedCategories
          }
        }
      );

      const { data, error } = response;

      // Log full response for debugging
      devLog('[Provider Signup] Edge Function Response:', {
        data: data,
        error: error,
        dataType: typeof data,
        errorType: typeof error
      });

      // Extract { message, code, missingFields } from Edge Function response
      const getEdgeFunctionError = (): { message: string; code: string | null; missingFields?: string[] } | null => {
        const fromPayload = (payload: any): { message: string; code: string | null; missingFields?: string[] } | null => {
          if (!payload) return null;
          
          devLog('[Provider Signup] Extracting error from payload:', payload);
          
          let message: string | null = null;
          let code: string | null = null;
          let missingFields: string[] | undefined = undefined;
          
          if (typeof payload === 'string') {
            message = payload;
          } else {
            // Check for error field (most common)
            if (payload.error !== undefined && payload.error !== null) {
              if (typeof payload.error === 'string') {
                message = payload.error;
              } else {
                message = payload.error?.error ?? payload.error?.message ?? null;
              }
            } 
            // Check for message field
            else if (payload.message) {
              message = payload.message;
            }
            
            // Extract code
            if (payload.code && typeof payload.code === 'string') {
              code = payload.code;
            }
            
            // Extract missingFields (can be at root level or nested)
            if (payload.missingFields && Array.isArray(payload.missingFields)) {
              missingFields = payload.missingFields;
            } else if (payload.error?.missingFields && Array.isArray(payload.error.missingFields)) {
              missingFields = payload.error.missingFields;
            }
          }
          
          if (!message) return null;
          
          devLog('[Provider Signup] Extracted error:', { message, code, missingFields });
          return { message, code, missingFields };
        };
        
        // Try data first
        if (data) {
          const result = fromPayload(data);
          if (result) return result;
        }
        
        // Try error object
        const err = error as any;
        if (err) {
          const result = fromPayload(err);
          if (result) return result;
        }
        
        // Try error.context
        if (err?.context) {
          let body = err.context;
          if (typeof body === 'string') {
            try { 
              body = JSON.parse(body); 
            } catch (e) { 
              console.error('[Provider Signup] Failed to parse error context:', e);
              return body ? { message: body, code: null } : null; 
            }
          }
          const result = fromPayload(body);
          if (result) return result;
        }
        
        // Try error.error
        if (err?.error && typeof err.error === 'object') {
          const result = fromPayload(err.error);
          if (result) return result;
        }
        
        return null;
      };

      const edgeError = getEdgeFunctionError();
      devLog('[Provider Signup] Final extracted error:', edgeError);

      if (data?.error !== undefined && data?.error !== null || error || !data || data.success !== true) {
        // Build detailed error message
        let errorMessage = 'An error occurred. Please try again.';
        
        if (edgeError) {
          errorMessage = edgeError.message;
          
          // Add missing fields details if available
          if (edgeError.missingFields && edgeError.missingFields.length > 0) {
            const fieldLabels = edgeError.missingFields.map(field => {
              const labels: { [key: string]: string } = {
                'firstName': 'First Name',
                'lastName': 'Last Name',
                'email': 'Email',
                'mobileNumber': 'Mobile Number',
                'dateOfBirth': 'Date of Birth',
                'selectedCategories': 'Specialization',
                'userId': 'User ID'
              };
              return labels[field] || field;
            });
            errorMessage = `Missing required fields: ${fieldLabels.join(', ')}`;
          }
          
          // Log full details for debugging
          console.error('[Provider Signup] Edge Function Error Details:', {
            message: edgeError.message,
            code: edgeError.code,
            missingFields: edgeError.missingFields,
            fullResponse: { data, error },
            sentData: {
              email: email,
              firstName: this.applicationForm.value.firstName,
              lastName: this.applicationForm.value.lastName,
              mobileNumber: mobileNumber,
              dateOfBirth: dateOfBirth,
              selectedCategories: selectedCategories
            }
          });
        } else {
          // If we couldn't extract error, show raw response
          console.error('[Provider Signup] Could not extract error. Raw response:', { data, error });
          if (data?.error) {
            errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          } else if (error) {
            errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
          }
        }
        
        await this.showToast(errorMessage, 'danger');
        
        if (edgeError?.code === 'EMAIL_EXISTS') {
          this.applicationForm.get('email')?.setErrors({ serverError: edgeError.message });
          this.applicationForm.get('email')?.markAsTouched();
        } else if (edgeError?.code === 'PHONE_EXISTS') {
          this.applicationForm.get('mobileNumber')?.setErrors({ serverError: edgeError.message });
          this.applicationForm.get('mobileNumber')?.markAsTouched();
        } else if (edgeError?.missingFields) {
          // Mark missing fields as invalid
          edgeError.missingFields.forEach(field => {
            const formControl = this.applicationForm.get(field);
            if (formControl) {
              formControl.setErrors({ serverError: `${this.getFieldLabel(field)} is required` });
              formControl.markAsTouched();
            }
          });
        }
        return;
      }

      this.showSuccessModal.set(true);
    } catch (err) {
      console.error('Submit error:', err);
      await this.showToast('Try again.', 'danger');
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

  onSuccessModalDismissed() {
    this.showSuccessModal.set(false);
    // Navigate to login page with login tab selected after modal is dismissed
    this.router.navigate(['/auth/login'], { queryParams: { tab: 'login' } });
  }

  getBackHref(): string {
    // Always return to login page with login tab selected
    return '/auth/login?tab=login';
  }
}
