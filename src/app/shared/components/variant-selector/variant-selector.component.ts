import { Component, Input, Output, EventEmitter, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, alertCircle } from 'ionicons/icons';
import {
  ServiceService,
  ServiceVariant,
  VariantProperties,
  VariantSelectionSchema,
  VariantSelector
} from '../../../core/services/service.service';

export interface VariantSelectionResult {
  variant: ServiceVariant;
  selections: VariantProperties;
}

@Component({
  selector: 'app-variant-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonBadge,
    IonIcon
  ],
  template: `
    <div class="variant-selector">
      @for (selector of availableSelectors(); track selector.key) {
        <ion-item lines="none" class="selector-item">
          <ion-label position="stacked">{{ selector.label }}</ion-label>
          <ion-select
            [placeholder]="'Select ' + selector.label"
            [value]="selections()[selector.key]"
            (ionChange)="onSelectionChange(selector.key, $event)"
            interface="action-sheet"
            [interfaceOptions]="{ header: selector.label }">
            @for (option of selector.options; track option.value) {
              <ion-select-option [value]="option.value">
                {{ option.label }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>
      }

      @if (selectedVariant()) {
        <div class="price-display">
          <div class="price-row">
            <span class="price-label">Standard Price:</span>
            <ion-badge color="primary">
              {{ formatPrice(selectedVariant()!.price_min, selectedVariant()!.price_max) }}
            </ion-badge>
          </div>
          @if (showAfter5Pricing) {
            <div class="price-row after5">
              <span class="price-label">After 5PM Price:</span>
              <ion-badge color="warning">
                {{ formatPrice(selectedVariant()!.price_after5_min, selectedVariant()!.price_after5_max) }}
              </ion-badge>
            </div>
          }
          <div class="duration-row">
            <ion-icon name="checkmark-circle" color="success"></ion-icon>
            <span>Est. {{ selectedVariant()!.duration_minutes }} minutes</span>
          </div>
        </div>
      } @else if (hasSelections() && !selectedVariant()) {
        <div class="no-variant-message">
          <ion-icon name="alert-circle" color="warning"></ion-icon>
          <span>No variant available for this combination</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .variant-selector {
      padding: 8px 0;
    }

    .selector-item {
      --padding-start: 0;
      --inner-padding-end: 0;
      --background: transparent;
      margin-bottom: 12px;
    }

    .selector-item ion-label {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-color-medium-shade);
      margin-bottom: 4px;
    }

    .selector-item ion-select {
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 10px;
      --padding-bottom: 10px;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 8px;
      width: 100%;
      max-width: 100%;
    }

    .price-display {
      background: var(--ion-color-light);
      border-radius: 12px;
      padding: 16px;
      margin-top: 16px;
    }

    .price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .price-row.after5 {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--ion-color-light-shade);
    }

    .price-label {
      font-size: 14px;
      color: var(--ion-color-medium);
    }

    .duration-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--ion-color-medium);
    }

    .duration-row ion-icon {
      font-size: 18px;
    }

    .no-variant-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--ion-color-warning-tint);
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
      color: var(--ion-color-warning-shade);
    }

    .no-variant-message ion-icon {
      font-size: 20px;
    }

    ion-badge {
      font-size: 14px;
      padding: 6px 12px;
    }
  `]
})
export class VariantSelectorComponent {
  private serviceService = inject(ServiceService);

  @Input() set schema(value: VariantSelectionSchema | undefined) {
    this._schema.set(value || null);
  }

  @Input() set variants(value: ServiceVariant[]) {
    this._variants.set(value);
  }

  @Input() showAfter5Pricing = true;

  @Output() variantSelected = new EventEmitter<VariantSelectionResult | null>();

  private _schema = signal<VariantSelectionSchema | null>(null);
  private _variants = signal<ServiceVariant[]>([]);

  selections = signal<VariantProperties>({});

  availableSelectors = computed(() => {
    const schema = this._schema();
    if (!schema) return [];

    return this.serviceService.getAvailableOptions(
      schema,
      this.selections(),
      this._variants()
    );
  });

  selectedVariant = computed(() => {
    const selections = this.selections();
    const variants = this._variants();
    if (Object.keys(selections).length === 0) return null;

    return this.serviceService.findVariantByProperties(variants, selections);
  });

  hasSelections = computed(() => {
    return Object.keys(this.selections()).length > 0;
  });

  constructor() {
    addIcons({ checkmarkCircle, alertCircle });

    // Emit variant when selection changes
    effect(() => {
      const variant = this.selectedVariant();
      const selections = this.selections();
      if (variant) {
        this.variantSelected.emit({ variant, selections });
      } else if (Object.keys(selections).length > 0) {
        this.variantSelected.emit(null);
      }
    });
  }

  onSelectionChange(key: string, event: CustomEvent) {
    const value = event.detail.value;
    const currentSelections = this.selections();

    // When a selection changes, we may need to clear dependent selections
    const newSelections: VariantProperties = {};
    const schema = this._schema();

    if (schema) {
      // Keep selections that don't depend on the changed key
      // and the new selection itself
      for (const selector of schema.selectors) {
        if (selector.key === key) {
          newSelections[key] = value;
        } else if (currentSelections[selector.key] !== undefined) {
          // Check if this selector depends on the changed key
          const dependsOnChangedKey = selector.dependsOn &&
            Object.keys(selector.dependsOn).includes(key);

          if (!dependsOnChangedKey) {
            newSelections[selector.key] = currentSelections[selector.key];
          }
          // If it depends on the changed key, we don't include it (it gets cleared)
        }
      }
    } else {
      newSelections[key] = value;
    }

    this.selections.set(newSelections);
  }

  formatPrice(min: number, max: number): string {
    if (min === max) {
      return `₱${min.toLocaleString()}`;
    }
    return `₱${min.toLocaleString()} - ₱${max.toLocaleString()}`;
  }

  reset() {
    this.selections.set({});
  }
}
