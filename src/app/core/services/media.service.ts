import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { devError } from '../utils/logger';
import { SessionService } from '../auth/session';
import { MediaFile, UploadedMedia, MediaType, MediaContext, MediaUploadError } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);

  private readonly BUCKET_NAME = 'booking-attachments';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  private readonly ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

  async uploadBookingMedia(
    bookingId: string,
    files: MediaFile[],
    context: MediaContext = 'PROBLEM_REPORT'
  ): Promise<UploadedMedia[]> {
    const user = this.sessionService.profile();
    if (!user) {
      throw new MediaUploadError('User not authenticated');
    }

    const uploadedFiles: UploadedMedia[] = [];
    const client = this.supabaseService.client;

    try {
      for (const file of files) {
        // Validate file
        this.validateFile(file);

        // Upload file
        const uploadedFile = await this.uploadSingleFile(bookingId, file);

        // Generate thumbnail for images
        let thumbnailUrl: string | undefined;
        if (file.type === 'image') {
          thumbnailUrl = await this.generateThumbnail(uploadedFile.url, file.type);
        }

        // Create media record
        const mediaRecord = {
          booking_id: bookingId,
          uploader_id: user.id,
          media_url: uploadedFile.url,
          thumbnail_url: thumbnailUrl,
          type: uploadedFile.type.toUpperCase() as MediaType,
          context: context,
          description: file.name,
          captured_at_location: null // Will be set when provider captures location-based media
        };

        const { data: mediaData, error: mediaError } = await client
          .from('booking_media')
          .insert(mediaRecord)
          .select('id')
          .single();

        if (mediaError) {
          throw new MediaUploadError(`Failed to create media record: ${mediaError.message}`, file.name);
        }

        uploadedFiles.push({
          id: mediaData.id,
          url: uploadedFile.url,
          thumbnailUrl,
          type: uploadedFile.type.toUpperCase() as MediaType,
          context
        });
      }

      return uploadedFiles;

    } catch (error) {
      // Cleanup uploaded files if any failed
      if (uploadedFiles.length > 0) {
        await this.cleanupUploadedFiles(bookingId, uploadedFiles);
      }
      throw error;
    }
  }

  private async uploadSingleFile(bookingId: string, file: MediaFile): Promise<{ url: string; type: string }> {
    const client = this.supabaseService.client;

    // Create unique file path
    const fileName = `${bookingId}/${Date.now()}_${this.sanitizeFileName(file.name)}`;
    const fileType = file.type;

    try {
      const { data, error } = await client.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new MediaUploadError(`Upload failed: ${error.message}`, file.name);
      }

      // Get public URL
      const { data: urlData } = client.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(data.path);

      return {
        url: urlData.publicUrl,
        type: fileType
      };

    } catch (error: any) {
      throw new MediaUploadError(`File upload failed: ${error?.message || 'Unknown error'}`, file.name);
    }
  }

  private async generateThumbnail(imageUrl: string, type: string): Promise<string | undefined> {
    if (type !== 'image') return undefined;

    try {
      // For now, return the original image as thumbnail
      // In a production app, you'd want to generate actual thumbnails
      // using a service like Cloudinary, ImageKit, or a server-side function
      return imageUrl;
    } catch (error) {
      devError('Thumbnail generation failed:', error);
      return undefined;
    }
  }

  private validateFile(file: MediaFile): void {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new MediaUploadError(`File size exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB limit`, file.name);
    }

    // Check file type
    const allowedTypes = file.type === 'image' ? this.ALLOWED_IMAGE_TYPES : this.ALLOWED_VIDEO_TYPES;
    if (!allowedTypes.includes(file.file.type)) {
      throw new MediaUploadError(`File type ${file.file.type} not allowed`, file.name);
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  private async cleanupUploadedFiles(bookingId: string, uploadedFiles: UploadedMedia[]): Promise<void> {
    const client = this.supabaseService.client;

    try {
      const filePaths = uploadedFiles.map(file => {
        // Extract path from public URL
        const url = new URL(file.url);
        const pathParts = url.pathname.split('/');
        return pathParts.slice(-2).join('/'); // Get bookingId/filename part
      });

      await client.storage
        .from(this.BUCKET_NAME)
        .remove(filePaths);

    } catch (error) {
      devError('Failed to cleanup uploaded files:', error);
    }
  }

  async deleteBookingMedia(mediaId: string): Promise<void> {
    const client = this.supabaseService.client;

    // Get media record first
    const { data: media, error: fetchError } = await client
      .from('booking_media')
      .select('media_url')
      .eq('id', mediaId)
      .single();

    if (fetchError) {
      throw new MediaUploadError(`Failed to find media record: ${fetchError.message}`);
    }

    // Delete from storage
    try {
      const url = new URL(media.media_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/');

      await client.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);
    } catch (storageError) {
      devError('Failed to delete from storage:', storageError);
    }

    // Delete record
    const { error: deleteError } = await client
      .from('booking_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      throw new MediaUploadError(`Failed to delete media record: ${deleteError.message}`);
    }
  }

  getMediaUrl(filePath: string): string {
    const client = this.supabaseService.client;
    const { data } = client.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}