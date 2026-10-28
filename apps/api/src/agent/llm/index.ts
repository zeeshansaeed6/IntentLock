import { env } from '../../config/env.js';
import type { LLMClient } from './types.js';
import { ScriptedLLM } from './scripted.js';
import { GeminiLLM } from './gemini.js';
import { OpenAILLM } from './openai.js';

export * from './types.js';
export { ScriptedLLM } from './scripted.js';
export { GeminiLLM } from './gemini.js';
export { OpenAILLM } from './openai.js';

const scriptedClient = new ScriptedLLM();

export function getLLMClient(): LLMClient {
  const provider = (env.LLM_PROVIDER || 'scripted').toLowerCase();

  if (provider === 'gemini') {
    return new GeminiLLM();
  }
  if (provider === 'openai') {
    return new OpenAILLM();
  }
  return scriptedClient;
}
