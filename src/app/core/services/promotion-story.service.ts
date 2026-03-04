import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { AuthEventsService } from '../auth/auth-events.service';
import { devError } from '../utils/logger';

export interface StoryOffer {
  id: string;
  title: string;
  image_url: string;
  sort_order: number;
}

@Injectable({
  providedIn: 'root',
})
export class PromotionStoryService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private authEventsService = inject(AuthEventsService);

  private _storyOffers = signal<StoryOffer[]>([]);
  private _isOpen = signal(false);
  private _shownThisSession = signal(false);

  readonly storyOffers = this._storyOffers.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly shownThisSession = this._shownThisSession.asReadonly();

  constructor() {
    effect(() => {
      const trigger = this.authEventsService.eventTrigger();
      if (trigger.event?.type === 'SIGNED_OUT' || trigger.event?.type === 'SESSION_EXPIRED') {
        this.resetSessionFlag();
      }
    });
  }

  readonly shouldShowModal = computed(() => {
    const profile = this.sessionService.profile();
    const role = profile?.role;
    const offers = this._storyOffers();
    const shown = this._shownThisSession();
    return (
      role === 'customer' &&
      offers.length > 0 &&
      !shown &&
      this.sessionService.isFullyAuthenticated()
    );
  });

  async loadStoryOffers(): Promise<void> {
    try {
      const now = new Date();
      const client = this.supabaseService.client as any;
      const { data, error } = await client
        .from('offers')
        .select('id, title, image_url, story_image_url, sort_order, starts_at, ends_at')
        .eq('status', 'active')
        .eq('show_in_story', true)
        .in('target_role', ['customer', 'all'])
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        devError('PromotionStoryService: Failed to load story offers', error);
        this._storyOffers.set([]);
        return;
      }

      const filtered = (data || []).filter((offer: any) => {
        const startsAt = offer.starts_at ? new Date(offer.starts_at) : null;
        const endsAt = offer.ends_at ? new Date(offer.ends_at) : null;
        const started = !startsAt || startsAt <= now;
        const notEnded = !endsAt || endsAt >= now;
        const hasStoryImage = !!offer.story_image_url?.trim();
        return started && notEnded && hasStoryImage;
      });

      const mapped: StoryOffer[] = filtered.map((o: any) => ({
        id: o.id,
        title: o.title,
        image_url: o.story_image_url,
        sort_order: o.sort_order ?? 100,
      }));

      this._storyOffers.set(mapped);
    } catch (err) {
      devError('PromotionStoryService: Error loading story offers', err);
      this._storyOffers.set([]);
    }
  }

  async tryShowModal(): Promise<boolean> {
    if (this._shownThisSession()) {
      return false;
    }
    if (this._storyOffers().length === 0) {
      await this.loadStoryOffers();
    }
    if (this._storyOffers().length > 0 && !this._shownThisSession()) {
      this._isOpen.set(true);
      return true;
    }
    return false;
  }

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
    this._shownThisSession.set(true);
  }

  resetSessionFlag(): void {
    this._shownThisSession.set(false);
  }
}
