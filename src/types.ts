import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

export interface GenAISpanProcessorOptions {
  /** Retain original ai.* attributes alongside gen_ai.* (default: true) */
  keepOriginal?: boolean;
  /** Forward mutated span to a downstream SpanProcessor */
  downstream?: SpanProcessor;
}
