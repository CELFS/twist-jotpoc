import { authenticatedFetch } from "@/platform/http";
import { generationFailure } from '@/translation/generation-error';
import { activityResponse } from '@/assistant/activity-timeout';
import { readSse } from '@/assistant/sse';
import { comparisonInputSchema, comparisonResultSchema, type ComparisonInput } from '@/translation/comparison-contracts';
import { cachedTranslationRequest, type TranslationRequestOptions } from './translation-cache';

export async function compareTranslation(input: ComparisonInput, options: TranslationRequestOptions = {}) {
  const parsed = comparisonInputSchema.parse(input);
  const schema = comparisonResultSchema.refine(value => value.language === parsed.language && value.model === parsed.model);
  return cachedTranslationRequest(JSON.stringify(['comparison', 1, parsed.text, parsed.sourceLanguage, parsed.language, parsed.model]), schema, async (signal, progress) => {
    const response = await activityResponse(requestSignal => authenticatedFetch('/api/extension/translations/comparison', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(parsed),
      signal: requestSignal,
    }), signal);
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'signedOut' : response.status === 429 ? 'rateLimited' : 'failed');
    for await (const data of readSse(response)) {
      signal.throwIfAborted();
      const event = JSON.parse(data);
      if (event.type === 'comparison_done') { const { type: _type, ...value } = event; return schema.parse(value); }
      if (event.type === 'error') throw generationFailure(event.code);
      if (event.type !== 'comparison_delta' || typeof event.text !== 'string' || event.text.length > 35000) throw new Error('failed');
      progress(event.text);
    }
    throw new Error('responseInterrupted');
  }, 7 * 86400000, options);
}
