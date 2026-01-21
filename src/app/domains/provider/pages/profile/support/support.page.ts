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
      label: 'Email Support',
      description: 'provider-support@after5.ph',
      action: 'email'
    },
    {
      icon: 'call-outline',
      label: 'Provider Hotline',
      description: '+63 917 123 4568',
      action: 'call'
    },
    {
      icon: 'chatbubbles-outline',
      label: 'Live Chat',
      description: 'Coming Soon',
      action: 'chat',
      disabled: true
    }
  ];

  readonly faqCategories: FAQCategory[] = [
    {
      title: 'Getting Started',
      icon: 'rocket-outline',
      items: [
        {
          question: 'How do I start receiving jobs?',
          answer: 'Once your account is verified and you\'re marked as "Available" in Service Settings, you\'ll automatically receive job notifications that match your services and are within your service radius.'
        },
        {
          question: 'How does job matching work?',
          answer: 'Jobs are matched based on your verified service categories, location, service radius, and availability. When a customer requests a service you offer, you\'ll receive a notification with job details.'
        },
        {
          question: 'What happens if I miss a job request?',
          answer: 'Job requests have a limited acceptance window. If you don\'t respond in time, the job will be offered to other available providers. Make sure your notifications are enabled to avoid missing opportunities.'
        }
      ]
    },
    {
      title: 'Jobs & Earnings',
      icon: 'cash-outline',
      items: [
        {
          question: 'How do I accept a job?',
          answer: 'When you receive a job notification, tap on it to view the details. If you\'re available and want to take the job, tap "Accept". The customer will be notified and you\'ll receive their address.'
        },
        {
          question: 'When do I get paid?',
          answer: 'Payments are processed after the customer confirms job completion. Earnings are transferred to your registered payout method (currently GCash) within 1-3 business days.'
        },
        {
          question: 'What if a customer doesn\'t pay?',
          answer: 'Always collect payment through the app. If you encounter payment issues, contact support immediately. Do not complete jobs without confirming payment status in the app.'
        },
        {
          question: 'How are service fees calculated?',
          answer: 'After5 charges a platform fee on each completed job. Your net earnings are shown in your wallet. The fee percentage is displayed in your provider agreement.'
        }
      ]
    },
    {
      title: 'Verification & Documents',
      icon: 'document-text-outline',
      items: [
        {
          question: 'What documents do I need?',
          answer: 'Required documents include: valid government ID, proof of address, clearance certificates, and relevant certifications for your service type. Requirements vary by service category.'
        },
        {
          question: 'How long does verification take?',
          answer: 'Document verification typically takes 1-3 business days. You\'ll receive a notification when your documents are approved or if additional information is needed.'
        },
        {
          question: 'Why was my document rejected?',
          answer: 'Common reasons include: unclear images, expired documents, or mismatched information. Check the rejection reason in your notification and resubmit with the correct document.'
        }
      ]
    },
    {
      title: 'Service Quality',
      icon: 'star-outline',
      items: [
        {
          question: 'How do ratings work?',
          answer: 'After each job, customers can rate your service from 1-5 stars and leave a review. Your overall rating is an average of all your ratings. Higher ratings lead to more job opportunities.'
        },
        {
          question: 'What is the body camera policy?',
          answer: 'Body cameras are optional but recommended for safety and dispute resolution. If you use one, ensure customers are notified. Recordings are stored securely and only accessed when necessary.'
        },
        {
          question: 'How can I improve my ratings?',
          answer: 'Be punctual, communicate clearly, do quality work, and be professional. Ask customers if they\'re satisfied before marking the job complete. Address any concerns on the spot.'
        }
      ]
    },
    {
      title: 'Account & Safety',
      icon: 'shield-checkmark-outline',
      items: [
        {
          question: 'What if I feel unsafe at a job?',
          answer: 'Your safety is priority. If you feel unsafe, leave immediately and report the incident through the app or call our emergency line. Never put yourself at risk.'
        },
        {
          question: 'Can I cancel a job I\'ve accepted?',
          answer: 'You can cancel before traveling to the location. Frequent cancellations may affect your account standing. If you need to cancel, do it as early as possible so the customer can find another provider.'
        },
        {
          question: 'How do I report a problem?',
          answer: 'Use the "Report Issue" button in the job details or contact support. Provide as much detail as possible including photos if relevant. We investigate all reports thoroughly.'
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
        window.location.href = 'mailto:provider-support@after5.ph';
        break;
      case 'call':
        window.location.href = 'tel:+639171234568';
        break;
      case 'chat':
        break;
    }
  }

  goBack() {
    this.router.navigate(['/p/profile']);
  }
}
