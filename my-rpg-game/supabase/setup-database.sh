#!/bin/bash

# ============================================================================
# Database Setup Script for RPG-JS Studio Integration
# ============================================================================
# This script sets up the complete database schema for real-time NPC sync
# ============================================================================

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  RPG-JS Studio Integration - Database Setup"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed${NC}"
    echo "Install it: npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${YELLOW}Warning: No Supabase project found in ./supabase/${NC}"
    echo "Make sure you're running this from the project root"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${YELLOW}Step 1: Linking to Supabase project...${NC}"
echo "If not already linked, run: supabase link --project-ref your-project-ref"
echo ""

# Test connection
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}Note: Local Supabase not running. Will use remote connection.${NC}"
    echo "To start local: supabase start"
    echo ""
fi

echo -e "${YELLOW}Step 2: Applying database migration...${NC}"
echo "This will create:"
echo "  • game.agent_configs - NPC configurations"
echo "  • game.agent_memory - Conversation history"
echo "  • game.api_integrations - API skills"
echo "  • game.player_state - Player positions"
echo "  • game.player_inventory - Player items"
echo "  • game.content_quests - Quest definitions"
echo "  • game.player_quests - Quest progress"
echo "  • game.live_events - Scheduled events"
echo "  • game.analytics_events - Game analytics"
echo "  • game.object_templates - Entity types"
echo ""

# Apply the migration
echo "Running migration: 001_initial_schema.sql"
if supabase db push --db-url "$DATABASE_URL" 2>/dev/null || supabase migration up; then
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    echo "Trying direct SQL execution..."
    
    # Fallback: execute SQL directly
    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Content-Type: application/json" \
            -d @supabase/migrations/001_initial_schema.sql
    else
        echo -e "${RED}Error: Cannot apply migration automatically${NC}"
        echo "Please apply the SQL manually in Supabase Dashboard:"
        echo "  1. Go to https://app.supabase.com"
        echo "  2. Select your project"
        echo "  3. Go to SQL Editor"
        echo "  4. Copy and paste: supabase/migrations/001_initial_schema.sql"
        echo "  5. Click Run"
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Step 3: Enabling Realtime...${NC}"
echo "Realtime is configured in the migration."
echo "Make sure it's enabled in your Supabase project:"
echo "  Database → Replication → Realtime → Toggle ON"
echo ""

echo -e "${YELLOW}Step 4: Deploying Edge Functions...${NC}"
echo ""

# Check if Edge Functions exist
if [ -d "supabase/functions/npc-ai-chat" ]; then
    echo "Deploying npc-ai-chat Edge Function..."
    if supabase functions deploy npc-ai-chat; then
        echo -e "${GREEN}✓ Edge Function deployed${NC}"
    else
        echo -e "${RED}✗ Edge Function deployment failed${NC}"
        echo "Deploy manually: supabase functions deploy npc-ai-chat"
    fi
else
    echo -e "${YELLOW}Warning: npc-ai-chat Edge Function not found${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Setting Edge Function Secrets...${NC}"
echo ""
echo "You'll need to set these secrets for AI to work:"
echo "  • OPENAI_API_KEY (optional)"
echo "  • KIMI_API_KEY (optional)"
echo "  • GEMINI_API_KEY (optional)"
echo ""

read -p "Do you want to set AI API keys now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "OpenAI API Key (press Enter to skip): " openai_key
    if [ -n "$openai_key" ]; then
        supabase secrets set OPENAI_API_KEY="$openai_key"
        echo -e "${GREEN}✓ OpenAI key set${NC}"
    fi
    
    read -p "Kimi API Key (press Enter to skip): " kimi_key
    if [ -n "$kimi_key" ]; then
        supabase secrets set KIMI_API_KEY="$kimi_key"
        echo -e "${GREEN}✓ Kimi key set${NC}"
    fi
    
    read -p "Gemini API Key (press Enter to skip): " gemini_key
    if [ -n "$gemini_key" ]; then
        supabase secrets set GEMINI_API_KEY="$gemini_key"
        echo -e "${GREEN}✓ Gemini key set${NC}"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}Database Setup Complete!${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Set environment variables in game server .env:"
echo "     SUPABASE_URL=$SUPABASE_URL"
echo "     SUPABASE_ANON_KEY=your-anon-key"
echo "     SUPABASE_SERVICE_ROLE_KEY=your-service-key"
echo ""
echo "  2. Start the game server:"
echo "     cd my-rpg-game && npm run dev"
echo ""
echo "  3. Create your first NPC in Studio!"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
