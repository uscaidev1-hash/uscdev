import { PixelAgent } from './agent.js';
import { loadAgents, loadSettings } from './config.js';
import { error, info } from './logger.js';
import { OpenRouterClient } from './openrouter.js';
import { readServerConfig } from './office.js';

async function main(): Promise<void> {
  const settings = loadSettings();
  const agents = loadAgents();
  const server = await readServerConfig();
  const openrouter = new OpenRouterClient();
  const abort = new AbortController();

  process.once('SIGINT', () => abort.abort());
  process.once('SIGTERM', () => abort.abort());

  info(`Pixel Agents OpenRouter 드라이버 시작: agents=${agents.length}, workspace=${settings.workspacePath}`);
  if (settings.offline) {
    info('오프라인 모드로 실행합니다. OpenRouter API를 호출하지 않습니다.');
  }

  await Promise.all(
    agents.map((agent) => new PixelAgent(agent, settings, server, openrouter).run(abort.signal)),
  );
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
