# OpenRouter Driver for Pixel Agents

This driver lets Pixel Agents animate independent OpenRouter-backed agents without starting Claude Code.

## Run

Start Pixel Agents first:

```bash
npm install
npm run build
node dist/cli.js --port 3100
```

In another terminal:

```bash
cd driver
npm install
npm run build
OPENROUTER_API_KEY=... npm start
```

On Windows PowerShell:

```powershell
$env:OPENROUTER_API_KEY="..."
npm start
```

The driver reads `~/.pixel-agents/server.json`, creates Claude-compatible transcript files under `~/.claude/projects/<cwd>/`, then posts Claude-shaped hook events to `/api/hooks/claude`.

## Configuration

Defaults live in `src/config.ts`. Override the agent list with `PIXEL_AGENTS_DRIVER_AGENTS`:

```json
[
  { "name": "김대리", "model": "openai/gpt-5-nano" },
  { "name": "박사원", "model": "openai/gpt-5.1-codex-mini" },
  { "name": "이주임", "model": "anthropic/claude-haiku-4.5" }
]
```

Useful environment variables:

- `OPENROUTER_API_KEY`: default API key for every agent.
- `OPENROUTER_BASE_URL`: defaults to `https://openrouter.ai/api/v1`.
- `PIXEL_AGENTS_DRIVER_WORKSPACE`: workspace path encoded into the transcript directory. Defaults to the current working directory.
- `PIXEL_AGENTS_DRIVER_INTERVAL_MS`: delay between turns. Defaults to `2000`.
- `PIXEL_AGENTS_DRIVER_ACTION_MS`: simulated action duration. Defaults to `2500`.
- `PIXEL_AGENTS_DRIVER_MAX_TURNS`: stop after N turns per agent. Useful for tests.
- `PIXEL_AGENTS_DRIVER_OFFLINE=1`: skip OpenRouter and use deterministic local actions.
