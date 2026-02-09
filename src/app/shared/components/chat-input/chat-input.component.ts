import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonTextarea, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, camera, image, close } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface ChatInputEvent {
  type: 'text' | 'image';
  content: string;
  file?: File;
}

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonTextarea, IonSpinner],
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.scss']
})
export class ChatInputComponent {
  @Input() placeholder: string = 'Type a message...';
  @Input() disabled: boolean = false;
  @Input() sending: boolean = false;
  @Input() maxLength: number = 2000;

  @Output() messageSend = new EventEmitter<ChatInputEvent>();
  @Output() typingChange = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  message: string = '';
  selectedImage: string | null = null;
  selectedFile: File | null = null;
  isTyping: boolean = false;

  private typingTimeout: any;
  private readonly TYPING_DEBOUNCE_MS = 1000;

  constructor() {
    addIcons({ send, camera, image, close });
  }

  get canSend(): boolean {
    return !this.disabled && !this.sending &&
      (this.message.trim().length > 0 || this.selectedImage !== null);
  }

  get characterCount(): number {
    return this.message.length;
  }

  onInput(): void {
    // Handle typing indicator
    if (!this.isTyping) {
      this.isTyping = true;
      this.typingChange.emit(true);
    }

    // Reset typing timeout
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.typingChange.emit(false);
    }, this.TYPING_DEBOUNCE_MS);
  }

  onKeyDown(event: KeyboardEvent): void {
    // Send on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (!this.canSend) return;

    // Stop typing indicator
    clearTimeout(this.typingTimeout);
    if (this.isTyping) {
      this.isTyping = false;
      this.typingChange.emit(false);
    }

    if (this.selectedImage && this.selectedFile) {
      // Send image
      this.messageSend.emit({
        type: 'image',
        content: this.selectedImage,
        file: this.selectedFile
      });
      this.clearImage();
    } else if (this.message.trim()) {
      // Send text
      this.messageSend.emit({
        type: 'text',
        content: this.message.trim()
      });
      this.message = '';
    }
  }

  async openCamera(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        width: 1024,
        height: 1024
      });

      if (photo.dataUrl) {
        this.selectedImage = photo.dataUrl;
        this.selectedFile = this.dataUrlToFile(photo.dataUrl, 'camera-photo.jpg');
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  }

  async openGallery(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 1024,
        height: 1024
      });

      if (photo.dataUrl) {
        this.selectedImage = photo.dataUrl;
        this.selectedFile = this.dataUrlToFile(photo.dataUrl, 'gallery-photo.jpg');
      }
    } catch (error) {
      console.error('Gallery error:', error);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        console.error('File too large');
        return;
      }

      // Read file as data URL for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedImage = e.target?.result as string;
        this.selectedFile = file;
      };
      reader.readAsDataURL(file);
    }
  }

  clearImage(): void {
    this.selectedImage = null;
    this.selectedFile = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private dataUrlToFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }
}
