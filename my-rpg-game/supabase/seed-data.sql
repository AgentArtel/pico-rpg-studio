-- ============================================================================
-- Seed Data for Testing
-- ============================================================================
-- Run this after the initial schema to create sample NPCs and data
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Sample NPCs for testing
-- -----------------------------------------------------------------------------

-- Merchant NPC
INSERT INTO game.agent_configs (
    id, name, description, graphic, personality, model, skills, spawn, behavior, inventory, enabled
) VALUES (
    'merchant-01',
    'Merchant Thorne',
    'A friendly merchant selling potions and basic gear',
    'female',
    'You are Merchant Thorne, a friendly shopkeeper. You sell health potions and basic equipment. You''re always polite and helpful. Keep responses brief (1-2 sentences).',
    '{"idle": "gpt-4o-mini", "conversation": "gpt-4o-mini"}',
    ARRAY['move', 'say', 'look', 'emote', 'wait'],
    '{"map": "simplemap", "x": 300, "y": 200}',
    '{"idleInterval": 15000, "patrolRadius": 2, "greetOnProximity": true}',
    ARRAY['shop-token'],
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    personality = EXCLUDED.personality,
    enabled = true;

-- Guard NPC
INSERT INTO game.agent_configs (
    id, name, description, graphic, personality, model, skills, spawn, behavior, inventory, enabled
) VALUES (
    'guard-01',
    'Guard Captain',
    'A stern guard protecting the town',
    'hero',
    'You are Guard Captain, a stern but fair protector of the town. You take your duty seriously and are suspicious of strangers. Be brief and direct in your responses.',
    '{"idle": "gpt-4o-mini", "conversation": "gpt-4o-mini"}',
    ARRAY['move', 'say', 'look', 'emote', 'wait'],
    '{"map": "simplemap", "x": 150, "y": 150}',
    '{"idleInterval": 10000, "patrolRadius": 5, "greetOnProximity": false}',
    ARRAY[],
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    personality = EXCLUDED.personality,
    enabled = true;

-- Mystic NPC (with image generation)
INSERT INTO game.agent_configs (
    id, name, description, graphic, personality, model, skills, spawn, behavior, inventory, enabled
) VALUES (
    'mystic-01',
    'Mira the Mystic',
    'A mysterious mystic who can generate visions (images)',
    'female',
    'You are Mira the Mystic, a mysterious seer who can generate visions using your magical crystal. Speak in a mystical, cryptic manner. When asked for a vision, use your generate_image skill.',
    '{"idle": "gpt-4o-mini", "conversation": "gpt-4o"}',
    ARRAY['move', 'say', 'look', 'emote', 'wait', 'generate_image'],
    '{"map": "simplemap", "x": 400, "y": 300}',
    '{"idleInterval": 20000, "patrolRadius": 1, "greetOnProximity": true}',
    ARRAY['image-gen-token'],
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    personality = EXCLUDED.personality,
    enabled = true;

-- -----------------------------------------------------------------------------
-- Sample Quests
-- -----------------------------------------------------------------------------

-- Simple kill quest
INSERT INTO game.content_quests (
    quest_id, title, description, objectives, reward_exp, reward_gold, published
) VALUES (
    'quest-001',
    'Slime Cleanup',
    'Help clean up the slimes that have infested the area.',
    '[
        {"type": "kill", "target": "slime", "count": 5, "description": "Defeat 5 slimes"}
    ]'::jsonb,
    100,
    50,
    true
) ON CONFLICT (quest_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    published = true;

-- Collection quest
INSERT INTO game.content_quests (
    quest_id, title, description, objectives, reward_exp, reward_gold, reward_items, published
) VALUES (
    'quest-002',
    'Herb Gathering',
    'Collect medicinal herbs for the village healer.',
    '[
        {"type": "collect", "item": "herb", "count": 3, "description": "Collect 3 medicinal herbs"}
    ]'::jsonb,
    75,
    30,
    '["health-potion"]'::jsonb,
    true
) ON CONFLICT (quest_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    published = true;

-- -----------------------------------------------------------------------------
-- Sample Live Event
-- -----------------------------------------------------------------------------

INSERT INTO game.live_events (
    event_type, title, description, starts_at, ends_at, config, active
) VALUES (
    'double_xp',
    'Double XP Weekend',
    'Earn double experience points for all activities!',
    NOW(),
    NOW() + INTERVAL '7 days',
    '{"multiplier": 2, "affected_maps": ["all"]}'::jsonb,
    true
) ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Test API Integration
-- -----------------------------------------------------------------------------

-- Ensure image generation is enabled
INSERT INTO game.api_integrations (
    name, skill_name, description, required_item_id, enabled
) VALUES (
    'Image Generation',
    'generate_image',
    'Generate images using AI vision magic',
    'image-gen-token',
    true
) ON CONFLICT (skill_name) DO UPDATE SET
    enabled = true;

-- -----------------------------------------------------------------------------
-- Verify Setup
-- -----------------------------------------------------------------------------

SELECT 'Setup complete!' as status;
SELECT COUNT(*) as npc_count FROM game.agent_configs WHERE enabled = true;
SELECT COUNT(*) as quest_count FROM game.content_quests WHERE published = true;
SELECT COUNT(*) as api_count FROM game.api_integrations WHERE enabled = true;
