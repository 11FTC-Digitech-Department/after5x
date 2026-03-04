import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { PromotionStoryService } from '@core/services/promotion-story.service';

@Component({
  selector: 'app-promotion-story-modal',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './promotion-story-modal.component.html',
  styleUrls: ['./promotion-story-modal.component.scss'],
})
export class PromotionStoryModalComponent {
  private promotionStoryService = inject(PromotionStoryService);

  readonly offers = this.promotionStoryService.storyOffers;
  readonly isOpen = this.promotionStoryService.isOpen;

  currentIndex = signal(0);

  readonly progressSegments = computed(() =>
    this.offers().map((_, i) => ({
      index: i,
      filled: i < this.currentIndex(),
      active: i === this.currentIndex(),
    }))
  );

  readonly canGoNext = computed(() => this.currentIndex() < this.offers().length - 1);
  readonly canGoPrev = computed(() => this.currentIndex() > 0);

  constructor() {
    addIcons({ close });
    effect(() => {
      if (!this.isOpen()) {
        this.currentIndex.set(0);
      }
    });
  }

  onClose(): void {
    this.promotionStoryService.close();
  }

  onNext(): void {
    if (this.canGoNext()) {
      this.currentIndex.update((i) => i + 1);
    } else {
      this.onClose();
    }
  }

  onPrev(): void {
    if (this.canGoPrev()) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  onContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) {
      this.onPrev();
    } else if (x > rect.width - third) {
      this.onNext();
    }
  }

  onProgressClick(index: number): void {
    this.currentIndex.set(index);
  }
}
