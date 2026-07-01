export type AgentAction = 'read' | 'write' | 'run' | 'rest';

export interface AgentDecision {
  action: AgentAction;
  target: string;
  reason: string;
}

export interface AgentConfig {
  name: string;
  model: string;
  systemPrompt?: string;
  apiKeyEnv?: string;
}

export interface DriverSettings {
  workspacePath: string;
  intervalMs: number;
  actionMs: number;
  maxTurns: number | null;
  offline: boolean;
}
