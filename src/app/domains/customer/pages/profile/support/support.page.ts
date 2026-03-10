import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAccordionGroup,
  IonAccordion,
  IonSearchbar,
  IonListHeader,
  IonText,
  IonNote
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

@Component({
  selector: 'app-support',
  templateUrl: './support.page.html',
  styleUrls: ['./support.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonAccordionGroup,
    IonAccordion,
    IonSearchbar,
    IonListHeader,
    IonText,
    IonNote,
    CommonModule,
    FormsModule
  ]
})
export class SupportPage {
  private router = inject(Router);

  searchQuery = signal('');

  readonly contactOptions = [
    {
      icon: 'mail-outline',
      label: 'Email',
      description: 'customerservice@after5.ph',
      action: 'email'
    },
    {
      icon: 'call-outline',
      label: 'Hotline',
      description: '0917-111-7555',
      action: 'call'
    }
  ];

  readonly faqCategories: FAQCategory[] = [
    {
      title: 'Getting Started',
      icon: 'rocket-outline',
      items: [
        {
          question: 'How do I book a service?',
          answer: 'To book a service, go to the Home tab, browse available services, select the one you need, choose your preferred date and time, confirm your address, and submit your booking request. A service provider will be matched with you shortly.'
        },
        {
          question: 'How do I create an account?',
          answer: 'You can create an account using your email address or phone number. Simply download the app, tap "Sign Up", and follow the registration process. You\'ll need to verify your email or phone number to complete registration.'
        },
        {
          question: 'What areas do you serve?',
          answer: 'After5 currently serves Metro Manila and surrounding areas. We are continuously expanding our coverage. Check the app for the most up-to-date service areas.'
        }
      ]
    },
    {
      title: 'Bookings & Payments',
      icon: 'calendar-outline',
      items: [
        {
          question: 'How do I pay for services?',
          answer: 'We accept cash payments and GCash. Payment is collected after the service is completed. The exact amount will be shown in your booking details before confirmation.'
        },
        {
          question: 'Can I cancel a booking?',
          answer: 'Yes, you can cancel a booking before the provider starts traveling to your location. Go to your Bookings tab, select the booking, and tap "Cancel Booking". Cancellation policies may apply depending on timing.'
        },
        {
          question: 'How do I reschedule a booking?',
          answer: 'To reschedule, go to your Bookings tab, select the booking you want to change, and tap "Reschedule". Choose a new date and time that works for you. The provider will be notified of the change.'
        },
        {
          question: 'What if I\'m not satisfied with the service?',
          answer: 'If you\'re not satisfied, please rate the service and provide feedback through the app. You can also contact our support team for assistance. We take all complaints seriously and will work to resolve any issues.'
        }
      ]
    },
    {
      title: 'Account & Profile',
      icon: 'person-outline',
      items: [
        {
          question: 'How do I update my profile?',
          answer: 'Go to the Profile tab, tap "Edit Profile", and you can update your name, phone number, and profile photo. Your email address cannot be changed after registration.'
        },
        {
          question: 'How do I change my address?',
          answer: 'Go to Profile > Addresses. You can add multiple addresses, edit existing ones, or set a default address for your bookings.'
        },
        {
          question: 'How do I delete my account?',
          answer: 'To delete your account, please contact our support team at customerservice@after5.ph. Note that account deletion is permanent and all your data will be removed.'
        }
      ]
    },
    {
      title: 'For Service Providers',
      icon: 'briefcase-outline',
      items: [
        {
          question: 'How do I become a provider?',
          answer: 'To become a service provider, download the After5 Provider app or switch to provider mode in your existing app. Complete the registration, submit required documents for verification, and once approved, you can start accepting jobs.'
        },
        {
          question: 'What documents do I need?',
          answer: 'You\'ll need a valid government ID, proof of address, and relevant certifications for your service type. Background checks may be required for certain services.'
        }
      ]
    },
    {
      title: 'Safety & Security',
      icon: 'shield-checkmark-outline',
      items: [
        {
          question: 'How do you verify providers?',
          answer: 'All providers undergo identity verification, background checks, and skills assessment. We also collect and review customer feedback to maintain service quality.'
        },
        {
          question: 'What is the body camera policy?',
          answer: 'For safety and quality assurance, providers may use body cameras during service. Recordings are stored securely and only accessed if there\'s a dispute or safety concern.'
        },
        {
          question: 'How is my data protected?',
          answer: 'We use industry-standard encryption to protect your personal data. Your information is never sold to third parties. Please review our Privacy Policy for full details.'
        }
      ]
    }
  ];

  filteredCategories = signal<FAQCategory[]>(this.faqCategories);

  onSearchChange(event: any) {
    const query = event.detail.value?.toLowerCase() || '';
    this.searchQuery.set(query);

    if (!query) {
      this.filteredCategories.set(this.faqCategories);
      return;
    }

    const filtered = this.faqCategories
      .map(category => ({
        ...category,
        items: category.items.filter(
          item =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query)
        )
      }))
      .filter(category => category.items.length > 0);

    this.filteredCategories.set(filtered);
  }

  async onContactClick(action: string) {
    switch (action) {
      case 'email':
        window.location.href = 'mailto:customerservice@after5.ph';
        break;
      case 'call':
        window.location.href = 'tel:+639171117555';
        break;
    }
  }

  goBack() {
    this.router.navigate(['/c/profile']);
  }
}
