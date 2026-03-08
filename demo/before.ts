/**
 * BEFORE: AI SDK with OTel — no adapter.
 * Spans will have ai.* attributes but gen_ai.* coverage is incomplete.
 * Run: npm run before
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  serviceName: 'ai-sdk-demo-BEFORE',
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

sdk.start();

async function main() {
  console.log('=== BEFORE (no adapter) ===');
  console.log('Making generateText call...\n');

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: 'What is 2+2? Answer in one word.',
    experimental_telemetry: { isEnabled: true },
  });

  console.log('Response:', result.text);
  console.log('Usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('\nSpans exported to Jaeger WITHOUT adapter.');
  console.log('Check http://localhost:16686 → service "ai-sdk-demo-BEFORE"');

  await sdk.shutdown();
}

main().catch(console.error);
