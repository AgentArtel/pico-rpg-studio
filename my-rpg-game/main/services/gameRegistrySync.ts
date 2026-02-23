/**
 * Game Registry Sync
 * Upserts available maps, sprites, spawn points, categories, and skills to game_registry table
 * so Studio dropdowns reflect actual game data.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { SupabaseClient } from '@supabase/supabase-js'

// Resolve directory of this file (works in ESM after rpgjs build)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface RegistryEntry {
  registry_type: string
  key: string
  label: string
  metadata: Record<string, any>
  is_active: boolean
  updated_at: string
}

interface WorldMapEntry {
  fileName: string
  width: number
  height: number
}

// Known sprites in spritesheets/characters/
const KNOWN_SPRITES = ['female', 'hero']

// Default categories
const CATEGORIES = [
  { key: 'npc', label: 'NPC' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'quest', label: 'Quest Giver' },
  { key: 'guard', label: 'Guard' },
]

// Default game skills
const SKILLS = [
  { key: 'move', label: 'Move', description: 'Move to a position' },
  { key: 'say', label: 'Say', description: 'Speak dialogue' },
  { key: 'look', label: 'Look', description: 'Look at something' },
  { key: 'emote', label: 'Emote', description: 'Play an emote animation' },
  { key: 'wait', label: 'Wait', description: 'Wait for a duration' },
]

/** Read myworld.world and return a mapId → pixel dimensions lookup */
function readWorldDimensions(): Record<string, { width: number; height: number }> {
  try {
    const worldPath = join(__dirname, '..', 'worlds', 'myworld.world')
    const world = JSON.parse(readFileSync(worldPath, 'utf-8'))
    const result: Record<string, { width: number; height: number }> = {}
    for (const entry of (world.maps as WorldMapEntry[])) {
      // "maps/simplemap.tmx" → "simplemap"
      const mapId = entry.fileName.replace(/^maps\//, '').replace(/\.tmx$/, '')
      result[mapId] = { width: entry.width, height: entry.height }
    }
    return result
  } catch {
    return {}
  }
}

/** Parse named spawn points (type="start") from a .tmx file */
function parseSpawnPoints(mapId: string): Array<{ name: string; x: number; y: number }> {
  try {
    const tmxPath = join(__dirname, '..', 'worlds', 'maps', `${mapId}.tmx`)
    const content = readFileSync(tmxPath, 'utf-8')
    const spawns: Array<{ name: string; x: number; y: number }> = []

    // Match opening <object ...> tags
    const objectRegex = /<object\s[^>]+>/g
    let match
    while ((match = objectRegex.exec(content)) !== null) {
      const tag = match[0]
      // Include objects with type="start" (RPGJS player spawn) or type="spawn" (NPC spawn points)
      if (!/type="(start|spawn)"/.test(tag)) continue
      const nameAttr = tag.match(/\bname="([^"]+)"/)
      const xAttr    = tag.match(/\bx="([^"]+)"/)
      const yAttr    = tag.match(/\by="([^"]+)"/)
      if (!nameAttr || !xAttr || !yAttr) continue
      spawns.push({
        name: nameAttr[1],
        x: Math.round(parseFloat(xAttr[1])),
        y: Math.round(parseFloat(yAttr[1])),
      })
    }
    return spawns
  } catch {
    return []
  }
}

export async function syncGameRegistry(
  supabase: SupabaseClient,
  availableMaps: any[]
): Promise<void> {
  const now = new Date().toISOString()
  const entries: RegistryEntry[] = []

  // Read world file for map pixel dimensions
  const worldDimensions = readWorldDimensions()

  // 1. Maps from runtime (with dimensions from world file)
  const mapKeys: string[] = []
  for (const mapClass of availableMaps) {
    const mapId = mapClass.id || mapClass
    mapKeys.push(mapId)
    const dims = worldDimensions[mapId] || {}
    entries.push({
      registry_type: 'map',
      key: mapId,
      label: mapId,
      metadata: dims,
      is_active: true,
      updated_at: now,
    })
  }

  // 2. Sprites
  for (const sprite of KNOWN_SPRITES) {
    entries.push({
      registry_type: 'sprite',
      key: sprite,
      label: sprite.charAt(0).toUpperCase() + sprite.slice(1),
      metadata: { spritesheet: sprite },
      is_active: true,
      updated_at: now,
    })
  }

  // 3. Spawn points from TMX object layers
  for (const mapId of mapKeys) {
    const spawns = parseSpawnPoints(mapId)
    for (const sp of spawns) {
      entries.push({
        registry_type: 'spawn_point',
        key: `${mapId}-${sp.name}`,
        label: sp.name === 'start' ? `${mapId} — Start` : sp.name,
        metadata: { mapId, x: sp.x, y: sp.y },
        is_active: true,
        updated_at: now,
      })
    }
  }

  // 4. Categories
  for (const cat of CATEGORIES) {
    entries.push({
      registry_type: 'category',
      key: cat.key,
      label: cat.label,
      metadata: {},
      is_active: true,
      updated_at: now,
    })
  }

  // 5. Skills
  for (const skill of SKILLS) {
    entries.push({
      registry_type: 'skill',
      key: skill.key,
      label: skill.label,
      metadata: { description: skill.description },
      is_active: true,
      updated_at: now,
    })
  }

  // Upsert all entries
  const { error } = await supabase
    .from('game_registry')
    .upsert(entries, { onConflict: 'registry_type,key' })

  if (error) {
    console.error('[GameRegistry] Sync failed:', error.message)
    return
  }

  // Mark maps not present in runtime as inactive
  if (mapKeys.length > 0) {
    const { error: deactivateError } = await supabase
      .from('game_registry')
      .update({ is_active: false, updated_at: now })
      .eq('registry_type', 'map')
      .eq('is_active', true)
      .not('key', 'in', `(${mapKeys.join(',')})`)

    if (deactivateError) {
      console.error('[GameRegistry] Failed to deactivate stale maps:', deactivateError.message)
    }
  }

  const spawnCount = entries.filter(e => e.registry_type === 'spawn_point').length
  console.log(`[GameRegistry] Synced ${entries.length} entries (${mapKeys.length} maps, ${spawnCount} spawn points)`)
}
