import { randomUUID } from 'node:crypto';

import {
  formatRestLog,
  normalizeDecision,
  offlineDecision,
  toOfficeTool,
} from './actions.js';
import { info, warn } from './logger.js';
import type { OpenRouterClient } from './openrouter.js';
import {
  appendAssistantToolUse,
  appendToolResult,
  appendTurnDuration,
  createSessionContext,
  ensureTranscript,
  postHook,
  sessionStartPayload,
  sleep,
  type ServerConfig,
} from './office.js';
import type { AgentConfig, DriverSettings } from './types.js';

export class PixelAgent {
  private readonly sessionId = randomUUID();
  private readonly context;

  constructor(
    private readonly config: AgentConfig,
    private readonly settings: DriverSettings,
    private readonly server: ServerConfig,
    private readonly openrouter: OpenRouterClient,
  ) {
    this.context = createSessionContext(this.sessionId, this.settings.workspacePath);
  }

  async run(signal: AbortSignal): Promise<void> {
    ensureTranscript(this.context, this.config.name, this.config.model);
    await postHook(this.server, sessionStartPayload(this.context));
    info(`[${this.config.name}] 세션을 시작했습니다. model=${this.config.model}`);

    let turn = 0;
    while (!signal.aborted && (this.settings.maxTurns === null || turn < this.settings.maxTurns)) {
      const decision = this.settings.offline
        ? offlineDecision(turn)
        : await this.decideWithFallback(turn);

      const tool = toOfficeTool(this.config.name, normalizeDecision(decision));
      if (!tool) {
        info(formatRestLog(this.config.name, decision));
        await postHook(this.server, {
          session_id: this.sessionId,
          hook_event_name: 'Stop',
        });
        appendTurnDuration(this.context);
        await sleep(this.settings.intervalMs);
        turn += 1;
        continue;
      }

      const toolId = `openrouter-${turn}-${Date.now()}`;
      info(tool.log);
      appendAssistantToolUse(this.context, toolId, tool.toolName, tool.toolInput);
      await postHook(this.server, {
        session_id: this.sessionId,
        hook_event_name: 'PreToolUse',
        tool_name: tool.toolName,
        tool_input: tool.toolInput,
      });
      await sleep(this.settings.actionMs);
      appendToolResult(this.context, toolId);
      await postHook(this.server, {
        session_id: this.sessionId,
        hook_event_name: 'PostToolUse',
      });
      await postHook(this.server, {
        session_id: this.sessionId,
        hook_event_name: 'Stop',
      });
      appendTurnDuration(this.context);

      turn += 1;
      await sleep(this.settings.intervalMs);
    }

    await postHook(this.server, {
      session_id: this.sessionId,
      hook_event_name: 'SessionEnd',
      reason: 'exit',
    }).catch((err: unknown) => warn(`[${this.config.name}] 종료 훅 전송 실패: ${String(err)}`));
    info(`[${this.config.name}] 루프를 종료했습니다.`);
  }

  private async decideWithFallback(turn: number) {
    try {
      return await this.openrouter.decide(this.config, turn);
    } catch (err) {
      warn(`[${this.config.name}] OpenRouter 호출 실패, 이번 턴은 대기합니다: ${String(err)}`);
      return {
        action: 'rest' as const,
        target: '',
        reason: '모델 호출이 잠시 실패해서 대기합니다',
      };
    }
  }
}
