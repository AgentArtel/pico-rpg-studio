# PicoClaw in the pico-rpg-studio Repo

In this repo, **PicoClaw** is the AI agent runtime for in-game NPCs. **Studio** deploys and configures agents via the **picoclaw-bridge** Edge Function (deploy/stop/status, push config and workspaces). The **game** sends player chat through the **npc-ai-chat** Edge Function to PicoClaw; PicoClaw runs the agent (LLM, skills, tools) and returns the response.

- [Project overview](../docs/PROJECT_OVERVIEW.md) — How the three projects (game, Studio, PicoClaw) connect.
- [Root README](../README.md) — Quick start and architecture.

For PicoClaw itself (build, run, upstream docs), see [README.md](README.md).
