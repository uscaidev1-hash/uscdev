import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ServerConfig {
  port: number;
  pid: number;
  token: string;
  startedAt: number;
}

export interface SessionContext {
  sessionId: string;
  cwd: string;
  projectDir: string;
  transcriptPath: string;
}

const SERVER_JSON = path.join(os.homedir(), '.pixel-agents', 'server.json');

export async function readServerConfig(timeoutMs = 15_000): Promise<ServerConfig> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SERVER_JSON, 'utf8')) as ServerConfig;
      if (parsed.port && parsed.token) {
        await assertServerHealthy(parsed);
        return parsed;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(250);
  }
  throw new Error(
    `Pixel Agents server is not reachable from ${SERVER_JSON}. ` +
      `Start Pixel Agents first, or delete stale server.json and restart it. ${lastError}`,
  );
}

export function createSessionContext(sessionId: string, cwd: string): SessionContext {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', normalizeProjectPath(cwd));
  return {
    sessionId,
    cwd,
    projectDir,
    transcriptPath: path.join(projectDir, `${sessionId}.jsonl`),
  };
}

export function ensureTranscript(context: SessionContext, agentName: string, model: string): void {
  fs.mkdirSync(context.projectDir, { recursive: true });
  if (fs.existsSync(context.transcriptPath)) return;
  appendJsonl(context.transcriptPath, {
    type: 'system',
    subtype: 'init',
    content: 'openrouter-driver-ready',
    agentName,
    model,
  });
}

export function appendAssistantToolUse(
  context: SessionContext,
  toolId: string,
  toolName: string,
  input: Record<string, unknown>,
): void {
  appendJsonl(context.transcriptPath, {
    type: 'assistant',
    message: {
      usage: { input_tokens: 0, output_tokens: 0 },
      content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    },
  });
}

export function appendToolResult(context: SessionContext, toolId: string): void {
  appendJsonl(context.transcriptPath, {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: toolId, content: 'simulated by OpenRouter driver' }],
    },
  });
}

export function appendTurnDuration(context: SessionContext): void {
  appendJsonl(context.transcriptPath, {
    type: 'system',
    subtype: 'turn_duration',
    duration_ms: 0,
  });
}

export async function postHook(
  server: ServerConfig,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = `http://127.0.0.1:${server.port}/api/hooks/claude`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${server.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const eventName =
      typeof payload['hook_event_name'] === 'string' ? payload['hook_event_name'] : 'unknown';
    throw new Error(
      `Pixel Agents hook POST failed for ${eventName} at ${url}. ` +
        `Is the Pixel Agents server running? ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new Error(`Pixel Agents hook POST failed: ${response.status} ${await response.text()}`);
  }
}

export function sessionStartPayload(context: SessionContext): Record<string, unknown> {
  return {
    session_id: context.sessionId,
    hook_event_name: 'SessionStart',
    source: 'openrouter-driver',
    transcript_path: context.transcriptPath,
    cwd: context.cwd,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendJsonl(filePath: string, record: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function assertServerHealthy(server: ServerConfig): Promise<void> {
  const url = `http://127.0.0.1:${server.port}/api/health`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(2000) });
  } catch (err) {
    throw new Error(
      `health check failed at ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new Error(`health check failed at ${url}: HTTP ${response.status}`);
  }
}

function normalizeProjectPath(absPath: string): string {
  return absPath.replace(/[^a-zA-Z0-9-]/g, '-');
}
