import type { AgentConfig, DriverSettings } from './types.js';

const JSON_INSTRUCTION =
  '반드시 {"action":"read|write|run|rest","target":"대상","reason":"한국어 한 줄"} JSON 하나만 출력하세요.';

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: '김대리',
    model: 'openai/gpt-5-nano',
    systemPrompt:
      '당신은 김대리입니다. 역할은 작업 계획, 요구사항 확인, 파일 읽기입니다. 성급히 수정하기보다 먼저 살펴보고 다음 행동을 고릅니다. ' +
      JSON_INSTRUCTION,
  },
  {
    name: '박사원',
    model: 'openai/gpt-5.1-codex-mini',
    systemPrompt:
      '당신은 박사원입니다. 역할은 코드 작성, 작은 수정, 실행할 명령 제안입니다. 구현에 필요한 다음 행동을 실무적으로 고릅니다. ' +
      JSON_INSTRUCTION,
  },
  {
    name: '이주임',
    model: 'anthropic/claude-haiku-4.5',
    systemPrompt:
      '당신은 이주임입니다. 역할은 리뷰, 정리, 검증입니다. 다른 직원의 작업이 맞는지 살피고 테스트나 휴식이 필요한지 판단합니다. ' +
      JSON_INSTRUCTION,
  },
];

const DEFAULT_SYSTEM_PROMPT =
  '당신은 픽셀 오피스에서 일하는 사무실 직원입니다. 다음에 할 일을 짧은 JSON으로만 고르세요. ' +
  JSON_INSTRUCTION;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadAgents(): AgentConfig[] {
  const raw = process.env['PIXEL_AGENTS_DRIVER_AGENTS'];
  if (!raw) return DEFAULT_AGENTS;

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('PIXEL_AGENTS_DRIVER_AGENTS must be a JSON array.');
  }

  const agents = parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Agent at index ${index} must be an object.`);
    }
    const candidate = item as Partial<AgentConfig>;
    if (!candidate.name || !candidate.model) {
      throw new Error(`Agent at index ${index} must include name and model.`);
    }
    return {
      name: candidate.name,
      model: candidate.model,
      systemPrompt: candidate.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      apiKeyEnv: candidate.apiKeyEnv,
    };
  });

  if (agents.length === 0) {
    throw new Error('PIXEL_AGENTS_DRIVER_AGENTS must contain at least one agent.');
  }

  return agents;
}

export function loadSettings(): DriverSettings {
  const maxTurnsRaw = process.env['PIXEL_AGENTS_DRIVER_MAX_TURNS'];
  const maxTurns = maxTurnsRaw ? parsePositiveInt(maxTurnsRaw, 0) : 0;
  return {
    workspacePath: process.env['PIXEL_AGENTS_DRIVER_WORKSPACE'] || process.env['INIT_CWD'] || process.cwd(),
    intervalMs: parsePositiveInt(process.env['PIXEL_AGENTS_DRIVER_INTERVAL_MS'], 2000),
    actionMs: parsePositiveInt(process.env['PIXEL_AGENTS_DRIVER_ACTION_MS'], 2500),
    maxTurns: maxTurns > 0 ? maxTurns : null,
    offline: process.env['PIXEL_AGENTS_DRIVER_OFFLINE'] === '1',
  };
}
