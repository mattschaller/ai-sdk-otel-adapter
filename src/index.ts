import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTRIBUTE_MAP, OPERATION_MAP, resolveOperationName, resolveProvider } from './mapping.js';
import type { GenAISpanProcessorOptions } from './types.js';

export { ATTRIBUTE_MAP, PROVIDER_MAP, OPERATION_MAP, resolveOperationName, resolveProvider } from './mapping.js';
export type { GenAISpanProcessorOptions } from './types.js';

export class GenAISpanProcessor implements SpanProcessor {
  private readonly keepOriginal: boolean;
  private readonly downstream?: SpanProcessor;

  constructor(options: GenAISpanProcessorOptions = {}) {
    this.keepOriginal = options.keepOriginal ?? true;
    this.downstream = options.downstream;
  }

  onStart(span: Span, parentContext: Context): void {
    this.downstream?.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    const attrs = span.attributes;

    // Fast path: skip spans with no ai.* attributes
    const hasAiAttr = Object.keys(attrs).some((k) => k.startsWith('ai.'));
    if (!hasAiAttr) {
      this.downstream?.onEnd(span);
      return;
    }

    // ReadableSpan is technically read-only, but mutating the internal attributes
    // object directly is the standard approach used by processors like Langfuse
    // and Arize. The OTel SDK stores attributes as a plain object, so this works.
    const mutableAttrs = attrs as Record<string, unknown>;

    for (const [aiKey, genAiKey] of Object.entries(ATTRIBUTE_MAP)) {
      if (!(aiKey in attrs)) continue;

      // Don't overwrite gen_ai attributes already set natively by the SDK
      if (genAiKey in attrs) continue;

      let value: unknown = attrs[aiKey];

      // Special handling per source key
      if (aiKey === 'ai.model.provider' && typeof value === 'string') {
        value = resolveProvider(value);
      } else if (aiKey === 'ai.operationId' && typeof value === 'string') {
        value = resolveOperationName(value);
      } else if (aiKey === 'ai.response.finishReason') {
        value = Array.isArray(value) ? value : [value];
      }

      mutableAttrs[genAiKey] = value;

      if (!this.keepOriginal) {
        delete mutableAttrs[aiKey];
      }
    }

    // Span name rewriting: map ai.* span names to gen_ai operation names
    if (span.name.startsWith('ai.')) {
      const stripped = span.name.slice(3);
      const base = stripped.split('.')[0];
      const mapped = OPERATION_MAP[base];
      if (mapped) {
        (span as any).name = mapped;
      }
    }

    this.downstream?.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.downstream?.forceFlush() ?? Promise.resolve();
  }

  shutdown(): Promise<void> {
    return this.downstream?.shutdown() ?? Promise.resolve();
  }
}
