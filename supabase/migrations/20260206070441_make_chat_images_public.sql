-- Migration: Make chat-images storage bucket public
-- Purpose: Fix broken images in chat - getPublicUrl() requires public bucket

UPDATE storage.buckets
SET public = true
WHERE id = 'chat-images';
