-- ============================================================================
-- RPG-JS Studio Integration - Initial Schema
-- ============================================================================
-- This migration sets up the complete database schema for real-time NPC sync
-- between Agent Artel Studio and RPG-JS game
-- ============================================================================

-- ============================================================================
-- 1. CREATE SCHEMAS
-- ============================================================================

-- Create game schema for shared game data
CREATE SCHEMA IF NOT EXISTS game;

-- Grant usage to PostgREST roles
GRANT USAGE ON SCHEMA game TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA game TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA game GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ============================================================================
-- 2. GAME TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- agent_configs: AI NPC configurations
-- Managed by Studio, read by Game
-- -----------------------------------------------------------------------------
CREATE TABLE game.agent_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    
    -- Visual
    graphic TEXT DEFAULT 'female',
    avatar_url TEXT,
    
    -- AI Configuration
    personality TEXT NOT NULL DEFAULT 'You are a helpful NPC.',
    model JSONB NOT NULL DEFAULT '{"idle": "gpt-4o-mini", "conversation": "gpt-4o-mini"}',
    
    -- Capabilities
    skills TEXT[] DEFAULT ARRAY['move', 'say', 'look', 'emote', 'wait']::TEXT[],
    inventory TEXT[] DEFAULT '{}'::TEXT[],
    
    -- Spawn location
    spawn JSONB NOT NULL DEFAULT '{"map": "simplemap", "x": 200, "y": 200}',
    
    -- Behavior
    behavior JSONB NOT NULL DEFAULT '{
        "idleInterval": 15000,
        "patrolRadius": 3,
        "greetOnProximity": true
    }'::JSONB,
    
    -- State
    enabled BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.agent_configs IS 'AI NPC configurations - managed by Studio, read by Game';

-- -----------------------------------------------------------------------------
-- agent_memory: NPC conversation history
-- Written by Game, read by Studio
-- -----------------------------------------------------------------------------
CREATE TABLE game.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    workflow_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.agent_memory IS 'NPC conversation history - written by Game, read by Studio';

-- -----------------------------------------------------------------------------
-- api_integrations: API-backed skills
-- Managed by Studio, read by Game
-- -----------------------------------------------------------------------------
CREATE TABLE game.api_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    skill_name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    
    -- Token gating
    required_item_id TEXT,
    
    -- Environment requirements
    requires_env TEXT[] DEFAULT '{}'::TEXT[],
    
    -- Configuration
    config JSONB DEFAULT '{}'::JSONB,
    
    -- State
    enabled BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.api_integrations IS 'API-backed skills (image gen, etc) - managed by Studio';

-- -----------------------------------------------------------------------------
-- player_state: Player position and state
-- Written by Game, read by Studio
-- -----------------------------------------------------------------------------
CREATE TABLE game.player_state (
    player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    
    -- Position
    map_id TEXT DEFAULT 'simplemap',
    position JSONB DEFAULT '{"x": 0, "y": 0}'::JSONB,
    direction INTEGER DEFAULT 2,
    
    -- Stats
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    gold INTEGER DEFAULT 0,
    
    -- State data
    state_data JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.player_state IS 'Player position and state - written by Game, read by Studio';

-- -----------------------------------------------------------------------------
-- player_inventory: Player items
-- Written by Game, read by Studio
-- -----------------------------------------------------------------------------
CREATE TABLE game.player_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(player_id, item_id)
);

COMMENT ON TABLE game.player_inventory IS 'Player inventory items';

-- -----------------------------------------------------------------------------
-- object_templates: Entity type definitions
-- Reference data for spawnable entities
-- -----------------------------------------------------------------------------
CREATE TABLE game.object_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_entity_type TEXT NOT NULL,
    default_sprite TEXT DEFAULT 'female',
    icon TEXT,
    description TEXT DEFAULT '',
    is_enabled BOOLEAN DEFAULT true
);

COMMENT ON TABLE game.object_templates IS 'Entity type definitions for spawnable objects';

-- -----------------------------------------------------------------------------
-- content_quests: Quest definitions
-- Managed by Studio, read by Game
-- -----------------------------------------------------------------------------
CREATE TABLE game.content_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Requirements
    min_level INTEGER DEFAULT 1,
    prerequisites JSONB DEFAULT '[]'::JSONB,
    
    -- Objectives
    objectives JSONB NOT NULL DEFAULT '[]'::JSONB,
    
    -- Rewards
    reward_exp INTEGER DEFAULT 0,
    reward_gold INTEGER DEFAULT 0,
    reward_items JSONB DEFAULT '[]'::JSONB,
    
    -- Quest giver
    giver_npc_id TEXT REFERENCES game.agent_configs(id),
    
    -- State
    published BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.content_quests IS 'Quest definitions - managed by Studio';

-- -----------------------------------------------------------------------------
-- player_quests: Player quest progress
-- Written by Game, read by Studio
-- -----------------------------------------------------------------------------
CREATE TABLE game.player_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL REFERENCES game.content_quests(quest_id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    progress JSONB DEFAULT '{}'::JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(player_id, quest_id)
);

COMMENT ON TABLE game.player_quests IS 'Player quest progress tracking';

-- -----------------------------------------------------------------------------
-- live_events: Scheduled game events
-- Managed by Studio, activated automatically
-- -----------------------------------------------------------------------------
CREATE TABLE game.live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Schedule
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- State
    active BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.live_events IS 'Scheduled game events (double XP, etc)';

-- -----------------------------------------------------------------------------
-- analytics_events: Game analytics
-- Written by Game, read by Studio
-- -----------------------------------------------------------------------------
CREATE TABLE game.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game.analytics_events IS 'Game analytics events';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Agent memory indexes
CREATE INDEX idx_agent_memory_session ON game.agent_memory(session_id, created_at DESC);
CREATE INDEX idx_agent_memory_npc ON game.agent_memory(session_id) WHERE role = 'assistant';

-- Player state indexes
CREATE INDEX idx_player_state_map ON game.player_state(map_id);
CREATE INDEX idx_player_state_last_seen ON game.player_state(last_seen_at DESC);

-- Player inventory indexes
CREATE INDEX idx_player_inventory_player ON game.player_inventory(player_id);

-- Quest indexes
CREATE INDEX idx_player_quests_player ON game.player_quests(player_id);
CREATE INDEX idx_player_quests_status ON game.player_quests(status);

-- Analytics indexes
CREATE INDEX idx_analytics_events_type ON game.analytics_events(event_type, created_at DESC);
CREATE INDEX idx_analytics_events_player ON game.analytics_events(player_id, created_at DESC);

-- Live events indexes
CREATE INDEX idx_live_events_active ON game.live_events(active) WHERE active = true;
CREATE INDEX idx_live_events_schedule ON game.live_events(starts_at, ends_at);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE game.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.object_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.content_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.player_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.analytics_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- agent_configs: Studio can manage, Game can read, Players can read published
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on agent_configs"
    ON game.agent_configs FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read enabled agent_configs"
    ON game.agent_configs FOR SELECT
    TO authenticated
    USING (enabled = true);

-- -----------------------------------------------------------------------------
-- agent_memory: Game can write, Studio can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on agent_memory"
    ON game.agent_memory FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read own agent_memory"
    ON game.agent_memory FOR SELECT
    TO authenticated
    USING (session_id LIKE '%_' || auth.uid()::text);

-- -----------------------------------------------------------------------------
-- api_integrations: Studio can manage, Game can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on api_integrations"
    ON game.api_integrations FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read enabled api_integrations"
    ON game.api_integrations FOR SELECT
    TO authenticated
    USING (enabled = true);

-- -----------------------------------------------------------------------------
-- player_state: Players can manage own, Studio can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on player_state"
    ON game.player_state FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage own player_state"
    ON game.player_state FOR ALL
    TO authenticated
    USING (player_id = auth.uid())
    WITH CHECK (player_id = auth.uid());

-- -----------------------------------------------------------------------------
-- player_inventory: Players can manage own, Studio can manage all
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on player_inventory"
    ON game.player_inventory FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage own player_inventory"
    ON game.player_inventory FOR ALL
    TO authenticated
    USING (player_id = auth.uid())
    WITH CHECK (player_id = auth.uid());

-- -----------------------------------------------------------------------------
-- object_templates: Studio can manage, Game can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on object_templates"
    ON game.object_templates FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read enabled object_templates"
    ON game.object_templates FOR SELECT
    TO authenticated
    USING (is_enabled = true);

-- -----------------------------------------------------------------------------
-- content_quests: Studio can manage, Game can read published
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on content_quests"
    ON game.content_quests FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read published content_quests"
    ON game.content_quests FOR SELECT
    TO authenticated
    USING (published = true);

-- -----------------------------------------------------------------------------
-- player_quests: Game can write, Players can read own, Studio can read all
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on player_quests"
    ON game.player_quests FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage own player_quests"
    ON game.player_quests FOR ALL
    TO authenticated
    USING (player_id = auth.uid())
    WITH CHECK (player_id = auth.uid());

-- -----------------------------------------------------------------------------
-- live_events: Studio can manage, Game can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on live_events"
    ON game.live_events FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read live_events"
    ON game.live_events FOR SELECT
    TO authenticated
    USING (true);

-- -----------------------------------------------------------------------------
-- analytics_events: Game can write, Studio can read
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role full access on analytics_events"
    ON game.analytics_events FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own analytics_events"
    ON game.analytics_events FOR SELECT
    TO authenticated
    USING (player_id = auth.uid());

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION game.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_agent_configs_timestamp
    BEFORE UPDATE ON game.agent_configs
    FOR EACH ROW EXECUTE FUNCTION game.update_timestamp();

CREATE TRIGGER update_content_quests_timestamp
    BEFORE UPDATE ON game.content_quests
    FOR EACH ROW EXECUTE FUNCTION game.update_timestamp();

-- ============================================================================
-- 6. REALTIME SETUP
-- ============================================================================

-- Enable realtime for all game tables
ALTER PUBLICATION supabase_realtime ADD TABLE game.agent_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE game.agent_memory;
ALTER PUBLICATION supabase_realtime ADD TABLE game.api_integrations;
ALTER PUBLICATION supabase_realtime ADD TABLE game.player_state;
ALTER PUBLICATION supabase_realtime ADD TABLE game.player_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE game.content_quests;
ALTER PUBLICATION supabase_realtime ADD TABLE game.player_quests;
ALTER PUBLICATION supabase_realtime ADD TABLE game.live_events;

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================

-- Default object templates
INSERT INTO game.object_templates (id, name, category, base_entity_type, default_sprite, icon, description) VALUES
('scripted-npc', 'Scripted NPC', 'npc', 'scripted-npc', 'female', '🤖', 'Basic scripted NPC'),
('ai-npc', 'AI NPC', 'npc', 'ai-npc', 'female', '🧠', 'AI-powered NPC'),
('hybrid-npc', 'Hybrid NPC', 'npc', 'hybrid-npc', 'female', '🔮', 'Hybrid AI NPC'),
('container', 'Container', 'container', 'container', 'chest', '📦', 'Lootable container'),
('static-object', 'Static Object', 'decoration', 'static-object', 'rock', '🌿', 'Static decoration'),
('area-trigger', 'Area Trigger', 'trigger', 'area-trigger', 'marker', '⚡', 'Invisible trigger zone')
ON CONFLICT (id) DO NOTHING;

-- Default API integrations
INSERT INTO game.api_integrations (name, skill_name, description, required_item_id, enabled) VALUES
('Image Generation', 'generate_image', 'Generate images using AI', 'image-gen-token', true),
('Chat Completion', 'chat_complete', 'Advanced AI chat', null, true)
ON CONFLICT (skill_name) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
