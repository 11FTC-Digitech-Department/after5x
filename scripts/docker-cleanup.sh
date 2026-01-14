#!/bin/bash

# Docker cleanup script for Supabase
# This script stops and removes only Supabase-related Docker containers, images, and volumes

echo "🧹 Starting Supabase Docker cleanup..."

# Stop Supabase database using CLI commands
echo "🛑 Stopping Supabase database with CLI commands..."
supabase stop || echo "Failed to stop with 'supabase db stop', trying with npx..."
npx supabase stop || echo "Failed to stop with 'npx supabase db stop', continuing with Docker cleanup..."

# Delete the supabase/.temp directory
echo "🗑️ Deleting supabase/.temp directory..."
rm -rf supabase/.temp || echo "No supabase/.temp directory found or unable to delete"

# Stop all running Supabase containers
echo "📦 Stopping Supabase containers..."
docker ps -a | grep supabase | awk '{print $1}' | xargs -r docker stop

# Remove all Supabase containers
echo "🗑️ Removing Supabase containers..."
docker ps -a | grep supabase | awk '{print $1}' | xargs -r docker rm

# Remove all Supabase images
echo "🖼️ Removing Supabase images..."
docker images | grep supabase | awk '{print $3}' | xargs -r docker rmi --force

# Remove Supabase volumes
echo "💾 Removing Supabase volumes..."
docker volume ls | grep supabase | awk '{print $2}' | xargs -r docker volume rm

# Remove Supabase networks
echo "🔌 Removing Supabase networks..."
docker network ls | grep supabase | awk '{print $1}' | xargs -r docker network rm

# Clean up any dangling resources related to Supabase
echo "🧼 Cleaning up dangling Supabase resources..."
docker system prune -f --filter "label=com.supabase.app"

echo "✅ Supabase Docker cleanup complete!"
echo "All Supabase containers, images, and volumes have been removed." 

supabase start