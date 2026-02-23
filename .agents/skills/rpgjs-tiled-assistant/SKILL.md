---
name: rpgjs-tiled-assistant
description: Validate and fix Tiled map integration issues for RPG-JS including tileset paths, layer properties, event positioning, and map configuration. Use when the user has Tiled map problems, needs to configure maps, or is setting up new maps in an RPG-JS project.
---

# RPG-JS Tiled Assistant

Validates and fixes Tiled map integration issues for RPG-JS games.

## Common Issues

### Tileset Path Problems
```
Error: Cannot find tileset "../../../tilesets/terrain.tsx"
```

**Solution**: Use relative paths from the map file location:
```xml
<!-- Good -->
<tileset firstgid="1" source="../tilesets/terrain.tsx"/>

<!-- Bad (absolute paths) -->
<tileset firstgid="1" source="C:/Users/.../terrain.tsx"/>
```

### Missing Embedded Tilesets
Maps must reference external tilesets (`.tsx` files), not embed them.

**In Tiled**:
1. Map → Add External Tileset
2. Save tileset as `.tsx` file
3. Do NOT use "Embed Tileset"

### Map File Location

Maps should be in `worlds/maps/`:
```
module/
└── worlds/
    └── maps/
        ├── town.tmx
        ├── dungeon.tmx
        └── tilesets/
            ├── terrain.tsx
            └── objects.tsx
```

## Map Configuration

```typescript
import { MapData, RpgMap } from '@rpgjs/server'

@MapData({
    id: 'town',
    file: require('./worlds/maps/town.tmx')
})
export default class TownMap extends RpgMap {
    onInit() { }
    onJoin(player: RpgPlayer) { }
    onLeave(player: RpgPlayer) { }
}
```

## Tiled Layer Requirements

| Layer Name | Purpose | Required |
|------------|---------|----------|
| `Ground` | Base tiles | Yes |
| `Above` | Overhead tiles | No |
| `Events` | Event positions | No |

## Event Positioning in Tiled

Create event positions using tile objects:

1. Create object layer named "Events"
2. Add tile objects at desired positions
3. Set custom property: `name` = event ID (e.g., `EV-001`)

## Validating Maps

### Check Tileset Paths
```bash
grep -r "source=" worlds/maps/*.tmx
```

All paths should be relative like `../tilesets/` or `./`

### Verify Map Loads
Check browser console for:
- 404 errors on tileset images
- XML parsing errors
- Missing tileset references

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find tileset` | Wrong path | Use relative paths |
| `Invalid XML` | Corrupted TMX | Re-save in Tiled |
| `Tiles not showing` | Image path wrong | Check tileset image paths |
| `Events not spawning` | Wrong layer name | Use "Events" layer |

## Best Practices

### Tileset Organization
```
worlds/
├── maps/
│   ├── town.tmx
│   └── dungeon.tmx
└── tilesets/
    ├── terrain.tsx      # Ground tiles
    ├── objects.tsx      # Objects, decorations
    └── characters.tsx   # NPC sprites
```

### Map IDs
Use descriptive, kebab-case IDs:
- `town-center`
- `dungeon-level-1`
- `world-map`

### Grid Size
Standard RPG-JS uses 32x32 pixel tiles.

## Troubleshooting

### Map Not Loading
1. Check file path in `@MapData`
2. Verify TMX file exists
3. Check all tileset paths are relative
4. Ensure tileset images exist

### Events Not Appearing
1. Verify "Events" object layer exists
2. Check event names match `EV-XXX` pattern
3. Ensure corresponding event class exists
4. Check event is registered in module

### Performance Issues
1. Reduce layer count
2. Use smaller tilesets
3. Avoid excessive tile animations
4. Optimize tileset image sizes

## Map Properties (Optional)

In Tiled, set custom properties on the map:
- `encounterRate`: Number (random battle chance)
- `bgm`: String (background music file)
- `bgs`: String (background sound file)

Access in code:
```typescript
onInit() {
    const encounterRate = this.getProperty('encounterRate') || 0
}
```
