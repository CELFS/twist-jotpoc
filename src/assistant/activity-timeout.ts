// Measure silence rather than the total duration of a healthy generation.
export const MODEL_SILENCE_MS = 120_000;
export function activityTimeout(parent: AbortSignal, silenceMs = MODEL_SILENCE_MS) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { if (timer !== undefined) clearTimeout(timer); parent.removeEventListener('abort', cancel); };
  const abort = (reason: unknown) => { dispose(); controller.abort(reason); };
  const cancel = () => abort(parent.reason);
  const touch = () => {
    if (controller.signal.aborted) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => abort(new DOMException('Response stalled', 'TimeoutError')), silenceMs);
  };
  parent.addEventListener('abort', cancel, { once: true });
  if (parent.aborted) cancel(); else touch();
  return { signal: controller.signal, touch, dispose, abort };
}

export function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    pending.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(signal.aborted ? signal.reason : error); });
    if (signal.aborted) abort();
  });
}

// Transport inactivity is separate from model silence: bytes keep the relay alive,
// while the provider watchdog ignores heartbeats and observes actual model deltas.
export async function activityResponse(request: (signal: AbortSignal) => Promise<Response>, parent = new AbortController().signal, silenceMs = MODEL_SILENCE_MS): Promise<Response> {
  const deadline = activityTimeout(parent, silenceMs);
  try {
    const response = await abortable(request(deadline.signal), deadline.signal);
    if (!response.body) { deadline.dispose(); return response; }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const { done, value } = await abortable(reader.read(), deadline.signal);
          if (done) { deadline.dispose(); reader.releaseLock(); output.close(); }
          else { if (value.byteLength) deadline.touch(); output.enqueue(value); }
        } catch (error) {
          deadline.abort(error); void reader.cancel(error).catch(() => undefined); output.error(error);
        }
      },
      cancel(reason) { deadline.abort(reason); void reader.cancel(reason).catch(() => undefined); },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) { deadline.abort(error); throw error; }
}
