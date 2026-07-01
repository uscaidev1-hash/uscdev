import { normalizeDecision } from './actions.js';
import type { AgentConfig, AgentDecision } from './types.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export class OpenRouterClient {
  private readonly baseUrl = process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1';

  async decide(agent: AgentConfig, turn: number): Promise<AgentDecision> {
    const apiKey = process.env[agent.apiKeyEnv ?? 'OPENROUTER_API_KEY'];
    if (!apiKey) {
      throw new Error(
        `${agent.apiKeyEnv ?? 'OPENROUTER_API_KEY'} is required unless PIXEL_AGENTS_DRIVER_OFFLINE=1.`,
      );
    }

    const body = {
      model: agent.model,
      messages: [
        {
          role: 'system',
          content:
            agent.systemPrompt ??
            '당신은 픽셀 오피스에서 일하는 사무실 직원입니다. JSON으로만 답하세요.',
        },
        {
          role: 'user',
          content:
            `에이전트 이름: ${agent.name}\n` +
            `현재 턴: ${turn}\n` +
            '가능한 action은 read, write, run, rest 뿐입니다.\n' +
            '반드시 {"action":"read|write|run|rest","target":"대상","reason":"한국어 한 줄"} JSON 하나만 출력하세요.',
        },
      ],
      max_tokens: 120,
      response_format: { type: 'json_object' },
    };

    const response = await this.postChatCompletion(body, apiKey);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (shouldRetryWithoutJsonMode(response.status, text)) {
        const fallbackResponse = await this.postChatCompletion({
          ...body,
          response_format: undefined,
        }, apiKey);
        return await this.parseResponse(agent, fallbackResponse);
      }
      throw new Error(formatOpenRouterError(agent.model, response.status, text));
    }

    return await this.parseResponse(agent, response);
  }

  private postChatCompletion(body: Record<string, unknown>, apiKey: string): Promise<Response> {
    const cleanBody = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );

    return fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/pixel-agents-hq/pixel-agents',
        'X-Title': 'Pixel Agents OpenRouter Driver',
      },
      body: JSON.stringify(cleanBody),
    });
  }

  private async parseResponse(agent: AgentConfig, response: Response): Promise<AgentDecision> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(formatOpenRouterError(agent.model, response.status, text));
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((part) => part.text ?? '').join('')
      : (content ?? '');

    return normalizeDecision(parseJsonObject(text));
  }
}

function shouldRetryWithoutJsonMode(status: number, text: string): boolean {
  if (status < 400 || status >= 500) return false;
  return /response_format|json_object|structured/i.test(text);
}

function formatOpenRouterError(model: string, status: number, text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return `OpenRouter ${status} (${model}): ${normalized.slice(0, 500)}`;
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
