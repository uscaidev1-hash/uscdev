import type { AgentDecision } from './types.js';

export interface OfficeToolAction {
  toolName: 'Read' | 'Edit' | 'Bash';
  toolInput: Record<string, unknown>;
  log: string;
}

const TARGET_FALLBACKS: Record<AgentDecision['action'], string> = {
  read: 'README.md',
  write: 'src/index.ts',
  run: 'npm test',
  rest: '',
};

export function normalizeDecision(value: unknown): AgentDecision {
  const fallback: AgentDecision = {
    action: 'rest',
    target: '',
    reason: '응답을 안정적으로 해석하지 못해서 잠깐 대기합니다',
  };
  if (!value || typeof value !== 'object') return fallback;

  const record = value as Record<string, unknown>;
  const action = typeof record['action'] === 'string' ? record['action'] : '';
  if (!['read', 'write', 'run', 'rest'].includes(action)) return fallback;

  const typedAction = action as AgentDecision['action'];
  const target =
    typeof record['target'] === 'string' && record['target'].trim()
      ? record['target'].trim()
      : TARGET_FALLBACKS[typedAction];
  const reason =
    typeof record['reason'] === 'string' && record['reason'].trim()
      ? record['reason'].trim().slice(0, 120)
      : '다음 업무 흐름을 정리하려고 합니다';

  return { action: typedAction, target, reason };
}

export function toOfficeTool(agentName: string, decision: AgentDecision): OfficeToolAction | null {
  switch (decision.action) {
    case 'read':
      return {
        toolName: 'Read',
        toolInput: { file_path: decision.target },
        log: `[${agentName}] ${decision.target} 파일을 살펴보고 있어요: ${decision.reason}`,
      };
    case 'write':
      return {
        toolName: 'Edit',
        toolInput: { file_path: decision.target },
        log: `[${agentName}] ${decision.target}를 수정하는 중이에요: ${decision.reason}`,
      };
    case 'run':
      return {
        toolName: 'Bash',
        toolInput: { command: decision.target },
        log: `[${agentName}] 명령을 실행하고 있어요: ${decision.target} (${decision.reason})`,
      };
    case 'rest':
      return null;
  }
}

export function formatRestLog(agentName: string, decision: AgentDecision): string {
  return `[${agentName}] 잠깐 대기 중이에요: ${decision.reason}`;
}

export function offlineDecision(turn: number): AgentDecision {
  const cycle: AgentDecision[] = [
    { action: 'read', target: 'README.md', reason: '현재 프로젝트의 목적을 확인하려고 합니다' },
    { action: 'write', target: 'driver/src/agent.ts', reason: '작업 루프를 다듬고 있습니다' },
    { action: 'run', target: 'npm run build', reason: '변경 사항이 빌드되는지 확인하려고 합니다' },
    { action: 'rest', target: '', reason: '다음 업무를 고르기 전에 잠깐 숨을 고릅니다' },
  ];
  return cycle[turn % cycle.length]!;
}
