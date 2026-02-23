# RPG JS Game

This is a project template for [RPGJS](https://rpgjs.dev) apps. It lives at https://github.com/rpgjs/starter.

## Plugin / module policy (internal)

- **Plugins = game only.** They are RPG-JS modules (entries in `rpg.toml`). Studio does not use them.
- **Internal-only:** We do not publish to npm or the RPG-JS repo. Use `./plugins/<name>` or `./modules/<name>` for new separable features; add `config.json` when you need options.
- **Existing code in `main/` stays as-is.** New, self-contained systems go in plugins/modules; new game content (maps, events, items) stays in `main/`. See `ideas/internal-plugins-policy.md` in the repo.

To create a new project based on this template using [degit](https://github.com/Rich-Harris/degit):

```bash
npx degit rpgjs/starter rpg-app
cd rpg-app
```
## Get started

Install the dependencies...

```bash
cd rpg-app
npm install
npm run dev
```

Navigate to [localhost:3000](http://localhost:3000). You should see your game running. Edit a file in `src`, save it, and reload the page to see your changes.

> Launch in RPG mode with `RPG_TYPE=rpg npm run dev`

## Production

### Build with NodeJS

```bash
NODE_ENV=production npm run build
```

### Build with Docker

```bash
sudo docker build -t rpg .
sudo docker run -p 3000:3000 -d rpg
```

## Resources

[Documentation](https://docs.rpgjs.dev)
[Community Help](https://community.rpgjs.dev)

## Credits for Sample package assets

### Sounds

[Davidvitas](https://www.davidvitas.com/portfolio/2016/5/12/rpg-music-pack)
Attribution 4.0 International (CC BY 4.0)- https://creativecommons.org/licenses/by/4.0/deed.en

### Graphics

[Pipoya](https://pipoya.itch.io)

### Icons

https://game-icons.net