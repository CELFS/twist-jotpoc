// Decode complete SSE frames across arbitrary UTF-8 and network chunk boundaries.
export async function* readSse(response: Response): AsyncGenerator<string> {
  if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream")) throw new Error("invalid_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) {
          if (data.length) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (buffer.length > 1_000_000) throw new Error("stream_too_large");
      if (done) break;
    }
  } finally {
    // Cleanup must not delay a terminal event when the upstream cancel promise stalls.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function eventResponse(produce: (emit: (event: unknown) => void, signal: AbortSignal) => Promise<void>, signal?: AbortSignal) {
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const write = (value: string) => { if (!closed) output.enqueue(encoder.encode(value)); };
      heartbeat = setInterval(() => write(": heartbeat\n\n"), 15000);
      try {
        write(": connected\n\n");
        await produce(event => write(`data: ${JSON.stringify(event)}\n\n`), combined);
      } catch {
        if (!combined.aborted) write('data: {"type":"error","code":"provider_unavailable"}\n\n');
      } finally {
        if (heartbeat !== undefined) clearInterval(heartbeat);
        if (!closed) { closed = true; output.close(); }
      }
    },
    cancel() { closed = true; if (heartbeat !== undefined) clearInterval(heartbeat); controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Content-Type-Options": "nosniff" } });
}
