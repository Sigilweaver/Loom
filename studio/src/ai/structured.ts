/**
 * Structured (JSON) generation for the Basic-mode assists.
 *
 * Cloud providers get a JSON-schema constrained response through the AI
 * SDK's structured output. OpenAI-compatible servers vary in support, so for
 * them the model is asked for JSON in the prompt and the reply is parsed and
 * validated here. Either way the caller gets a value that matches the schema
 * or an error that says what went wrong.
 */

import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import type { AIProvider } from '@state/aiStore';
import { classifyError } from './errors';

export type StructuredResult<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/** Strip a Markdown code fence a model may wrap around JSON. */
export function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** Parse and validate a text reply against a schema. */
export function parseStructuredText<T>(text: string, schema: z.ZodType<T>, what: string): StructuredResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return { error: `The model did not return valid JSON for the ${what}. Try again or rephrase the request.` };
  }
  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return { error: `Invalid ${what} from AI: ${describeIssues(validated.error)}` };
  }
  return { value: validated.data };
}

export function usesNativeStructuredOutput(provider: AIProvider): boolean {
  return provider !== 'openai-compatible';
}

export async function generateStructured<T>(options: {
  model: LanguageModel;
  provider: AIProvider;
  prompt: string;
  schema: z.ZodType<T>;
  /** Wrap a top-level array schema: providers require an object at the root. */
  arrayElement?: z.ZodType<unknown>;
  what: string;
  maxOutputTokens: number;
}): Promise<StructuredResult<T>> {
  const { generateText, Output } = await import('ai');
  try {
    if (usesNativeStructuredOutput(options.provider)) {
      const output = options.arrayElement
        ? Output.array({ element: options.arrayElement })
        : Output.object({ schema: options.schema });
      const result = await generateText({
        model: options.model,
        prompt: options.prompt,
        maxOutputTokens: options.maxOutputTokens,
        output,
        // OpenAI's strict mode rejects optional fields and open maps, which
        // these schemas use; non-strict still constrains the reply to JSON
        // that follows the schema, and it is validated below.
        providerOptions: { openai: { strictJsonSchema: false } },
      });
      const validated = options.schema.safeParse(result.output);
      return validated.success
        ? { value: validated.data }
        : { error: `Invalid ${options.what} from AI: ${describeIssues(validated.error)}` };
    }
    const result = await generateText({
      model: options.model,
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens,
    });
    return parseStructuredText(result.text ?? '', options.schema, options.what);
  } catch (err) {
    if ((err as Error)?.name === 'AI_NoObjectGeneratedError') {
      return { error: `The model did not return a valid ${options.what}. Try again or rephrase the request.` };
    }
    return { error: classifyError(err).displayMessage };
  }
}
