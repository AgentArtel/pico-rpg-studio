# Database Setup Guide
## Complete Instructions for Setting Up the Database

---

## Quick Start (Automated)

### Option 1: Using the Setup Script

```bash
cd my-rpg-game

# Make script executable
chmod +x supabase/setup-database.sh

# Run the setup script
./supabase/setup-database.sh
```

This will:
1. ✅ Create the `game` schema
2. ✅ Create all 9 tables
3. ✅ Set up Row Level Security (RLS)
4. ✅ Enable Realtime
5. ✅ Add indexes for performance
6. ✅ Deploy Edge Functions (if they exist)

---

## Manual Setup (Step by Step)

### Step 1: Open Supabase SQL Editor

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### Step 2: Run the Schema Migration

Copy the entire contents of `my-rpg-game/supabase/migrations/001_initial_schema.sql` and paste it into the SQL Editor.

Then click **"Run"**.

### Step 3: Enable Realtime

1. Go to **Database** → **Replication**
2. Find **"Realtime"** section
3. Toggle **ON**
4. Verify these tables are listed:
   - `game.agent_configs`
   - `game.agent_memory`
   - `game.api_integrations`
   - `game.player_state`
   - `game.player_inventory`
   - `game.content_quests`
   - `game.player_quests`
   - `game.live_events`

### Step 4: Add Seed Data (Optional)

For testing, run the seed data:

1. In SQL Editor, open `my-rpg-game/supabase/seed-data.sql`
2. Copy and paste
3. Click **"Run"**

This creates 3 sample NPCs:
- **Merchant Thorne** - Sells potions
- **Guard Captain** - Protects the town
- **Mira the Mystic** - Can generate images

---

## Verify the Setup

### Check Tables Exist

Run this SQL:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'game';
```

You should see:
```
agent_configs
agent_memory
api_integrations
player_state
player_inventory
object_templates
content_quests
player_quests
live_events
analytics_events
```

### Check RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'game';
```

All should show `rowsecurity = true`.

### Test Insert

```sql
-- This should work (service role)
INSERT INTO game.agent_configs (id, name, personality, spawn)
VALUES ('test-npc', 'Test', 'Hello!', '{"map": "simplemap", "x": 100, "y": 100}');

-- Verify
SELECT * FROM game.agent_configs WHERE id = 'test-npc';

-- Clean up
DELETE FROM game.agent_configs WHERE id = 'test-npc';
```

---

## What Gets Created

### Tables

| Table | Purpose | Rows (est) |
|-------|---------|------------|
| `agent_configs` | NPC definitions | 10-100 |
| `agent_memory` | Conversation history | 1000s |
| `api_integrations` | API skills | 5-20 |
| `player_state` | Player positions | 100s |
| `player_inventory` | Player items | 1000s |
| `object_templates` | Entity types | 10-50 |
| `content_quests` | Quest definitions | 10-100 |
| `player_quests` | Quest progress | 1000s |
| `live_events` | Scheduled events | 10-20 |
| `analytics_events` | Game analytics | Millions |

### Security

- **Row Level Security (RLS)** enabled on all tables
- **Service role** has full access
- **Authenticated users** have limited access:
  - Can read published content
  - Can manage their own player data
  - Cannot modify NPCs directly

### Performance

Indexes created on:
- `agent_memory(session_id, created_at)`
- `player_state(map_id, last_seen_at)`
- `player_inventory(player_id)`
- `player_quests(player_id, status)`
- `analytics_events(event_type, created_at)`
- `live_events(active, starts_at)`

### Realtime

All tables enabled for Realtime:
- Changes broadcast to subscribers
- Studio gets live updates
- Game server syncs instantly

---

## Troubleshooting

### Error: "Schema 'game' does not exist"

**Fix:** Run the migration again. The first line creates the schema.

### Error: "Permission denied"

**Fix:** Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE schemaname = 'game';
```

### Error: "Realtime not working"

**Fix:** Enable Realtime in Dashboard:
1. Database → Replication
2. Toggle Realtime ON
3. Restart connection

### Error: "Table already exists"

**Fix:** Migration uses `IF NOT EXISTS`, so this shouldn't happen. If it does:
```sql
DROP SCHEMA game CASCADE;
-- Then re-run migration
```

---

## Next Steps

After database setup:

1. **Set environment variables** in `.env`:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   ```

2. **Start the game server**:
   ```bash
   cd my-rpg-game
   npm run dev
   ```

3. **Create your first NPC** in Studio!

---

## Schema Reference

### agent_configs

```sql
id TEXT PRIMARY KEY              -- Unique ID (e.g., 'merchant-01')
name TEXT                        -- Display name
graphic TEXT                     -- Sprite (male, female, hero)
personality TEXT                 -- AI system prompt
model JSONB                      -- {idle: string, conversation: string}
skills TEXT[]                    -- [move, say, look, generate_image]
inventory TEXT[]                 -- [image-gen-token, shop-token]
spawn JSONB                      -- {map: string, x: number, y: number}
behavior JSONB                   -- {idleInterval, patrolRadius, greetOnProximity}
enabled BOOLEAN                  -- On/off switch
```

### agent_memory

```sql
id UUID PRIMARY KEY
session_id TEXT                  -- npcId_playerId
role TEXT                        -- user, assistant, system, tool
content TEXT                     -- Message content
created_at TIMESTAMPTZ
```

---

## Need Help?

If the automated script fails, you can always:

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Copy/paste the migration file
4. Run manually

This gives you full control and error messages.
