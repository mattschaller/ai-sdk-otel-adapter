/** Primary mapping: ai.* attribute key → gen_ai.* attribute key */
export const ATTRIBUTE_MAP: Record<string, string> = {
  // Model identification
  'ai.model.id':                    'gen_ai.request.model',
  'ai.model.provider':              'gen_ai.system',
  'ai.response.model':              'gen_ai.response.model',
  'ai.response.id':                 'gen_ai.response.id',

  // Token usage — SDK uses promptTokens/completionTokens
  'ai.usage.promptTokens':          'gen_ai.usage.input_tokens',
  'ai.usage.completionTokens':      'gen_ai.usage.output_tokens',
  // Alternate names some providers/versions may use
  'ai.usage.inputTokens':           'gen_ai.usage.input_tokens',
  'ai.usage.outputTokens':          'gen_ai.usage.output_tokens',
  // Extended token types (no native gen_ai equivalent emitted by SDK)
  'ai.usage.cachedInputTokens':     'gen_ai.usage.cache_read_input_tokens',
  'ai.usage.reasoningTokens':       'gen_ai.usage.reasoning_tokens',

  // Tool calls (NOT emitted as gen_ai by SDK — core gap)
  'ai.toolCall.name':               'gen_ai.tool.name',
  'ai.toolCall.id':                 'gen_ai.tool.call.id',
  'ai.toolCall.args':               'gen_ai.tool.call.arguments',

  // Response
  'ai.response.finishReason':       'gen_ai.response.finish_reasons',
  'ai.response.text':               'gen_ai.completion',

  // Operation identification
  'ai.operationId':                 'gen_ai.operation.name',

  // Request parameters
  'ai.request.temperature':         'gen_ai.request.temperature',
  'ai.request.maxTokens':           'gen_ai.request.max_tokens',
  'ai.request.frequencyPenalty':     'gen_ai.request.frequency_penalty',
  'ai.request.presencePenalty':      'gen_ai.request.presence_penalty',
  'ai.request.topK':                'gen_ai.request.top_k',
  'ai.request.topP':                'gen_ai.request.top_p',
  'ai.request.stopSequences':       'gen_ai.request.stop_sequences',
};

/** Provider name normalization: ai.model.provider value → gen_ai.system value */
export const PROVIDER_MAP: Array<{ pattern: RegExp; system: string }> = [
  { pattern: /^openai\b/i,            system: 'openai' },
  { pattern: /^anthropic\b/i,         system: 'anthropic' },
  { pattern: /^google\b|^vertex\b/i,  system: 'vertex_ai' },
  { pattern: /^mistral\b/i,           system: 'mistral_ai' },
  { pattern: /^cohere\b/i,            system: 'cohere' },
  { pattern: /^amazon-bedrock\b/i,    system: 'aws_bedrock' },
];

/** Operation name normalization: base operation → gen_ai.operation.name */
export const OPERATION_MAP: Record<string, string> = {
  'generateText':   'chat',
  'streamText':     'chat',
  'generateObject': 'chat',
  'streamObject':   'chat',
  'embed':          'embeddings',
  'embedMany':      'embeddings',
};

/**
 * Extract base operation from ai.operationId value and map it.
 *
 * "ai.generateText"            → "chat"
 * "ai.generateText.doGenerate" → "chat"
 * "ai.toolCall"                → "toolCall"
 */
export function resolveOperationName(operationId: string): string {
  const stripped = operationId.startsWith('ai.') ? operationId.slice(3) : operationId;
  const base = stripped.split('.')[0];
  return OPERATION_MAP[base] ?? base;
}

/** Resolve provider string to gen_ai.system value using PROVIDER_MAP. */
export function resolveProvider(provider: string): string {
  for (const { pattern, system } of PROVIDER_MAP) {
    if (pattern.test(provider)) return system;
  }
  return provider;
}
