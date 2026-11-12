export type GenerationErrorCode = 'responseTimeout' | 'responseInterrupted' | 'responseInvalid' | 'responseLimit';
export function generationErrorCode(error: unknown): GenerationErrorCode | undefined {
  const code = error instanceof Error ? error.message : error;
  if (error instanceof Error && error.name === 'TimeoutError' || code === 'provider_timeout' || code === 'responseTimeout') return 'responseTimeout';
  if (error instanceof TypeError || ['incomplete_stream', 'network_error', 'stream_interrupted', 'responseInterrupted'].includes(String(code))) return 'responseInterrupted';
  if (error instanceof SyntaxError || error instanceof Error && error.name === 'ZodError' || ['provider_invalid_response', 'invalid_response', 'invalid_stream', 'responseInvalid'].includes(String(code))) return 'responseInvalid';
  if (['output_limit', 'response_too_large', 'responseLimit'].includes(String(code))) return 'responseLimit';
  return undefined;
}
export function generationFailure(code: unknown) {
  return new Error(generationErrorCode(code) ?? (code === 'provider_rate_limited' ? 'rateLimited' : 'failed'));
}
