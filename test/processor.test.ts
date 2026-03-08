import { describe, it, expect, vi } from 'vitest';
import type { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';
import { GenAISpanProcessor, ATTRIBUTE_MAP } from '../src/index.js';

function createTestSpan(
  name: string,
  attributes: Record<string, unknown>,
): ReadableSpan & { name: string; attributes: Record<string, unknown> } {
  return {
    name,
    attributes: { ...attributes },
    // Stubs for the rest of the ReadableSpan interface
    kind: 0,
    spanContext: () => ({
      traceId: '0'.repeat(32),
      spanId: '0'.repeat(16),
      traceFlags: 0,
    }),
    parentSpanId: undefined,
    startTime: [0, 0],
    endTime: [1, 0],
    status: { code: 0 },
    links: [],
    events: [],
    duration: [1, 0],
    ended: true,
    resource: { attributes: {} } as any,
    instrumentationLibrary: { name: 'test' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  } as any;
}

describe('GenAISpanProcessor', () => {
  // 1. Basic attribute remapping
  it('remaps ai.model.id to gen_ai.request.model', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', { 'ai.model.id': 'gpt-4o' });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
  });

  // 2. All attributes mapped
  it('maps all ai.* attributes from ATTRIBUTE_MAP', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', {
      'ai.model.id': 'gpt-4o',
      'ai.model.provider': 'openai.chat',
      'ai.response.model': 'gpt-4o-2024-05-13',
      'ai.response.id': 'chatcmpl-abc123',
      'ai.usage.promptTokens': 100,
      'ai.usage.completionTokens': 50,
      'ai.usage.cachedInputTokens': 20,
      'ai.usage.reasoningTokens': 10,
      'ai.toolCall.name': 'get_weather',
      'ai.toolCall.id': 'call_abc',
      'ai.toolCall.args': '{"city":"NYC"}',
      'ai.response.finishReason': 'stop',
      'ai.response.text': 'Hello world',
      'ai.operationId': 'ai.generateText',
      'ai.request.temperature': 0.7,
      'ai.request.maxTokens': 1000,
      'ai.request.frequencyPenalty': 0.5,
      'ai.request.presencePenalty': 0.3,
      'ai.request.topK': 40,
      'ai.request.topP': 0.9,
      'ai.request.stopSequences': ['END'],
    });
    processor.onEnd(span);

    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
    expect(span.attributes['gen_ai.system']).toBe('openai');
    expect(span.attributes['gen_ai.response.model']).toBe('gpt-4o-2024-05-13');
    expect(span.attributes['gen_ai.response.id']).toBe('chatcmpl-abc123');
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(100);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(50);
    expect(span.attributes['gen_ai.usage.cache_read_input_tokens']).toBe(20);
    expect(span.attributes['gen_ai.usage.reasoning_tokens']).toBe(10);
    expect(span.attributes['gen_ai.tool.name']).toBe('get_weather');
    expect(span.attributes['gen_ai.tool.call.id']).toBe('call_abc');
    expect(span.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"NYC"}');
    expect(span.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
    expect(span.attributes['gen_ai.completion']).toBe('Hello world');
    expect(span.attributes['gen_ai.operation.name']).toBe('chat');
    expect(span.attributes['gen_ai.request.temperature']).toBe(0.7);
    expect(span.attributes['gen_ai.request.max_tokens']).toBe(1000);
    expect(span.attributes['gen_ai.request.frequency_penalty']).toBe(0.5);
    expect(span.attributes['gen_ai.request.presence_penalty']).toBe(0.3);
    expect(span.attributes['gen_ai.request.top_k']).toBe(40);
    expect(span.attributes['gen_ai.request.top_p']).toBe(0.9);
    expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(['END']);
  });

  // 3. Token attributes use correct SDK names
  it('maps promptTokens/completionTokens to input_tokens/output_tokens', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', {
      'ai.usage.promptTokens': 100,
      'ai.usage.completionTokens': 50,
    });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(100);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(50);
  });

  // 4. Provider normalization
  it.each([
    ['openai.chat', 'openai'],
    ['anthropic.messages', 'anthropic'],
    ['google.generative-ai', 'vertex_ai'],
    ['vertex.chat', 'vertex_ai'],
    ['mistral.chat', 'mistral_ai'],
    ['cohere.chat', 'cohere'],
    ['amazon-bedrock.anthropic', 'aws_bedrock'],
  ])('normalizes provider "%s" to "%s"', (input, expected) => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', { 'ai.model.provider': input });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.system']).toBe(expected);
  });

  // 5. Unknown provider passthrough
  it('passes through unknown provider values as-is', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', { 'ai.model.provider': 'custom-provider' });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.system']).toBe('custom-provider');
  });

  // 6. Operation name mapping via ai.operationId
  it.each([
    ['ai.generateText', 'chat'],
    ['ai.streamText', 'chat'],
    ['ai.embed', 'embeddings'],
    ['ai.embedMany', 'embeddings'],
  ])('maps operationId "%s" to "%s"', (input, expected) => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('test', { 'ai.operationId': input });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.operation.name']).toBe(expected);
  });

  // 7. Nested operation ID mapping
  it.each([
    ['ai.generateText.doGenerate', 'chat'],
    ['ai.streamText.doStream', 'chat'],
  ])('maps nested operationId "%s" to "%s"', (input, expected) => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('test', { 'ai.operationId': input });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.operation.name']).toBe(expected);
  });

  // 8. Unknown operation passthrough
  it('passes through unknown operation names', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('test', { 'ai.operationId': 'ai.customOp' });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.operation.name']).toBe('customOp');
  });

  // 9. finish_reasons array wrapping
  it('wraps scalar finishReason in an array', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', { 'ai.response.finishReason': 'stop' });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
  });

  // 10. keepOriginal: true (default)
  it('retains original ai.* attributes by default', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', { 'ai.model.id': 'gpt-4o' });
    processor.onEnd(span);
    expect(span.attributes['ai.model.id']).toBe('gpt-4o');
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
  });

  // 11. keepOriginal: false
  it('removes original ai.* attributes when keepOriginal is false', () => {
    const processor = new GenAISpanProcessor({ keepOriginal: false });
    const span = createTestSpan('ai.generateText', {
      'ai.model.id': 'gpt-4o',
      'ai.usage.promptTokens': 100,
    });
    processor.onEnd(span);
    expect(span.attributes['ai.model.id']).toBeUndefined();
    expect(span.attributes['ai.usage.promptTokens']).toBeUndefined();
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(100);
  });

  // 12. Don't overwrite existing gen_ai attributes
  it('does not overwrite existing gen_ai.* attributes', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', {
      'ai.model.id': 'gpt-4o',
      'gen_ai.request.model': 'gpt-4o-from-sdk',
    });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o-from-sdk');
  });

  // 13. Downstream processor forwarding
  it('forwards mutated span to downstream onEnd and delegates onStart', () => {
    const downstream: SpanProcessor = {
      onStart: vi.fn(),
      onEnd: vi.fn(),
      forceFlush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new GenAISpanProcessor({ downstream });

    const mockSpan = {} as Span;
    const mockContext = {} as Context;
    processor.onStart(mockSpan, mockContext);
    expect(downstream.onStart).toHaveBeenCalledWith(mockSpan, mockContext);

    const span = createTestSpan('ai.generateText', { 'ai.model.id': 'gpt-4o' });
    processor.onEnd(span);
    expect(downstream.onEnd).toHaveBeenCalledWith(span);
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
  });

  // 14. Downstream forceFlush/shutdown delegation
  it('delegates forceFlush and shutdown to downstream', async () => {
    const downstream: SpanProcessor = {
      onStart: vi.fn(),
      onEnd: vi.fn(),
      forceFlush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new GenAISpanProcessor({ downstream });

    await processor.forceFlush();
    expect(downstream.forceFlush).toHaveBeenCalled();

    await processor.shutdown();
    expect(downstream.shutdown).toHaveBeenCalled();
  });

  // 15. Non-AI spans pass through unchanged
  it('does not modify spans without ai.* attributes', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('HTTP GET', {
      'http.method': 'GET',
      'http.url': 'https://example.com',
    });
    const originalAttrs = { ...span.attributes };
    processor.onEnd(span);
    expect(span.attributes).toEqual(originalAttrs);
    expect(Object.keys(span.attributes).some((k) => k.startsWith('gen_ai.'))).toBe(false);
  });

  // 16. Span name rewriting
  it.each([
    ['ai.generateText', 'chat'],
    ['ai.streamText.doStream', 'chat'],
    ['ai.embed', 'embeddings'],
  ])('rewrites span name "%s" to "%s"', (input, expected) => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan(input, { 'ai.operationId': input });
    processor.onEnd(span);
    expect(span.name).toBe(expected);
  });

  // 17. Span name preserved for unmapped operations
  it('preserves span name for unmapped operations like ai.toolCall', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.toolCall', { 'ai.toolCall.name': 'get_weather' });
    processor.onEnd(span);
    expect(span.name).toBe('ai.toolCall');
  });

  // 18. Mixed attributes
  it('processes only ai.* attributes, leaving others untouched', () => {
    const processor = new GenAISpanProcessor();
    const span = createTestSpan('ai.generateText', {
      'ai.model.id': 'gpt-4o',
      'http.method': 'POST',
      'http.url': 'https://api.openai.com/v1/chat/completions',
      'custom.attribute': 42,
    });
    processor.onEnd(span);
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4o');
    expect(span.attributes['http.method']).toBe('POST');
    expect(span.attributes['http.url']).toBe('https://api.openai.com/v1/chat/completions');
    expect(span.attributes['custom.attribute']).toBe(42);
  });
});
