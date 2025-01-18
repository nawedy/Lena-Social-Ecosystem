#!/bin/bash

# Exit on error
set -e

echo "Starting cache warming..."

# Load environment variables
source .env

# Function to warm up a specific endpoint
warm_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local data=$3
    
    echo "Warming $method $endpoint..."
    
    if [ "$method" = "GET" ]; then
        curl -s -X $method \
            -H "Authorization: Bearer ${ADMIN_TOKEN}" \
            "http://localhost:3000/api/$endpoint"
    else
        curl -s -X $method \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}" \
            -d "$data" \
            "http://localhost:3000/api/$endpoint"
    fi
    
    echo " Done."
}

# Warm up static assets
echo "Warming static assets..."
curl -s http://localhost:3000/static/js/main.js > /dev/null
curl -s http://localhost:3000/static/css/main.css > /dev/null
curl -s http://localhost:3000/static/media/logo.png > /dev/null

# Warm up AT Protocol endpoints
echo "Warming AT Protocol endpoints..."
warm_endpoint "bsky/feed"
warm_endpoint "bsky/trending"
warm_endpoint "bsky/suggested"
warm_endpoint "bsky/following"
warm_endpoint "bsky/followers"

# Warm up beta-specific endpoints
warm_endpoint "beta/features"
warm_endpoint "beta/stats"
warm_endpoint "beta/templates"

# Warm up game state cache
echo "Warming game state cache..."
for i in {1..10}; do
    warm_endpoint "game/state/$i" "POST" '{"gameType": "practice"}'
done

# Warm up user preferences
echo "Warming user preferences cache..."
warm_endpoint "users/preferences/defaults"

# Warm up AI models
echo "Warming AI models..."
warm_endpoint "ai/models/load" "POST" '{"models": ["text-generation", "image-generation"]}'

# Warm up analytics cache
echo "Warming analytics cache..."
warm_endpoint "analytics/summary"
warm_endpoint "analytics/trends"
warm_endpoint "analytics/popular-templates"

# Warm up search index
echo "Warming search index..."
for query in "game" "template" "tiktok" "social" "viral"; do
    warm_endpoint "search?q=$query"
done

# Verify cache status
echo "Verifying cache status..."
redis-cli info | grep 'used_memory_human\|keyspace'

echo "Cache warming completed successfully!"
