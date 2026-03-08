/**
 * AFTER: AI SDK with OTel + ai-sdk-otel-adapter.
 * Spans get gen_ai.* attributes mapped from ai.* — standard backends work.
 * Run: npm run after
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { GenAISpanProcessor } from 'ai-sdk-otel-adapter';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  serviceName: 'ai-sdk-demo-AFTER',
  spanProcessors: [
    new GenAISpanProcessor({
      downstream: new SimpleSpanProcessor(exporter),
    }),
  ],
});

sdk.start();

async function main() {
  console.log('=== AFTER (with ai-sdk-otel-adapter) ===');
  console.log('Making generateText call...\n');

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: 'What is 2+2? Answer in one word.',
    experimental_telemetry: { isEnabled: true },
  });

  console.log('Response:', result.text);
  console.log('Usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('\nSpans exported to Jaeger WITH adapter.');
  console.log('Check http://localhost:16686 → service "ai-sdk-demo-AFTER"');
  console.log('Compare gen_ai.* attributes vs the BEFORE trace!');

  await sdk.shutdown();
}

main().catch(console.error);
