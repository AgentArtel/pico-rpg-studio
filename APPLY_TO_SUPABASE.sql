-- =====================================================
-- APPLY THIS SQL TO SUPABASE PROJECT: ktxdbeamrxhjtdattwts
-- Run via Supabase Dashboard → SQL Editor
-- =====================================================

-- Create tables in public schema for RPG-JS game server

-- 1. agent_configs - NPC configuration from Studio
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'npc',
  base_entity_type TEXT NOT NULL DEFAULT 'ai-npc',
  default_sprite TEXT,
  icon TEXT DEFAULT '🤖',
  description TEXT,
  prompt TEXT NOT NULL,
  welcome_message TEXT DEFAULT 'Hello! How can I help you?',
  model JSONB DEFAULT '{"provider":"openai","model":"gpt-4","temperature":0.7}'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  required_tokens JSONB DEFAULT '[]'::jsonb,
  personality JSONB DEFAULT '{"traits":[],"voice":"neutral","background":""}'::jsonb,
  memory_config JSONB DEFAULT '{"contextWindow":10,"rememberPlayer":true}'::jsonb,
  spawn_config JSONB DEFAULT '{"mapId":"simplemap","x":0,"y":0}'::jsonb,
  appearance JSONB DEFAULT '{"sprite":"female","animations":{}}'::jsonb,
  behavior JSONB DEFAULT '{"wander":false,"wanderRadius":0,"patrolPath":[]}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. agent_memory - NPC conversation memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  npc_id TEXT NOT NULL REFERENCES public.agent_configs(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. player_state - Track player positions
CREATE TABLE IF NOT EXISTS public.player_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT UNIQUE NOT NULL,
  map_id TEXT NOT NULL,
  position JSONB NOT NULL,
  direction TEXT DEFAULT 'down',
  status TEXT DEFAULT 'online',
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. npc_instances - Active NPC instances in game
CREATE TABLE IF NOT EXISTS public.npc_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES public.agent_configs(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL UNIQUE,
  map_id TEXT NOT NULL,
  position JSONB NOT NULL,
  status TEXT DEFAULT 'idle',
  current_players TEXT[] DEFAULT '{}',
  spawned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. sync_status - Track synchronization status
CREATE TABLE IF NOT EXISTS public.sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  UNIQUE(entity_type, entity_id, source, target)
);

-- Enable RLS on all tables
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Add permissive policies for development (restrict for production!)
CREATE POLICY "Allow all" ON public.agent_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.agent_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.player_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.npc_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.sync_status FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_memory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.npc_instances;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON public.agent_memory(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_npc ON public.agent_memory(npc_id);
CREATE INDEX IF NOT EXISTS idx_player_state_map ON public.player_state(map_id);
CREATE INDEX IF NOT EXISTS idx_npc_instances_map ON public.npc_instances(map_id);
CREATE INDEX IF NOT EXISTS idx_npc_instances_config ON public.npc_instances(config_id);

-- Insert sample NPCs
INSERT INTO public.agent_configs (id, name, category, base_entity_type, default_sprite, icon, description, prompt, welcome_message, model, skills, spawn_config)
VALUES 
  ('npc-elara', 'Elara', 'npc', 'ai-npc', 'female', '✨', 'A mysterious sorceress', 
   'You are Elara, a wise sorceress who helps adventurers. Be mystical but helpful.', 
   'Greetings, traveler. I sense great potential in you...',
   '{"provider":"openai","model":"gpt-4","temperature":0.7}'::jsonb,
   '[{"name":"generate-image","description":"Create visualizations"}]'::jsonb,
   '{"mapId":"simplemap","x":400,"y":300}'::jsonb
  ),
  ('npc-guard', 'Town Guard', 'npc', 'ai-npc', 'hero', '⚔️', 'Protects the town',
   'You are a town guard. You protect the citizens and give directions to travelers.',
   'Halt! State your business in our fair town.',
   '{"provider":"openai","model":"gpt-3.5-turbo","temperature":0.5}'::jsonb,
   '[]'::jsonb,
   '{"mapId":"simplemap","x":200,"y":200}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

SELECT 'Tables created successfully!' as result;
