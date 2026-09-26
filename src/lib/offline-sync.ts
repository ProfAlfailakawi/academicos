import { useCallback, useEffect, useState } from "react";
import { ApiError, isNetworkFailure, sendQueuedRequest } from "./api";
import { enqueueWrite, flushQueue, listQueue, QUEUE_EVENT, type QueuedWrite, type SendOutcome } from "./offline-store";

const MAX_ATTEMPTS = 6;

/** Transport used when flushing the offline queue. */
export async function sendQueuedEntry(entry: QueuedWrite): Promise<SendOutcome> {
  try {
    await sendQueuedRequest(entry);
    return "sent";
  } catch (error) {
    if (isNetworkFailure(error)) return "retry";
    if (error instanceof ApiError && (error.status >= 500 || error.status === 408 || error.status === 429))
      return (entry.attempts || 0) + 1 >= MAX_ATTEMPTS ? "drop" : "retry";
    // 4xx: the server rejected the edit (conflict, permission, validation). Retrying cannot help.
    return "drop";
  }
}

/**
 * Perform a write now, or queue it when the device is offline / the network
 * drops. Returns { queued: true } when the write will be replayed later.
 */
export async function writeOrQueue<T>(
  entry: Omit<QueuedWrite, "id" | "createdAt" | "idempotencyKey">,
  perform: () => Promise<T>,
): Promise<{ queued: false; result: T } | { queued: true }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueWrite(entry);
    return { queued: true };
  }
  try {
    return { queued: false, result: await perform() };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    await enqueueWrite(entry);
    return { queued: true };
  }
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Online state + pending queue size; flushes automatically when connectivity returns. */
export function useOfflineQueue() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<{ sent: number; dropped: number } | null>(null);

  const refresh = useCallback(() => {
    listQueue().then((items) => setPending(items.length)).catch(() => setPending(0));
  }, []);

  const flush = useCallback(async () => {
    const result = await flushQueue(sendQueuedEntry);
    if (result.sent || result.dropped) setLastSync({ sent: result.sent, dropped: result.dropped });
    refresh();
    return result;
  }, [refresh]);

  useEffect(() => {
    refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  return { online, pending, flush, lastSync, clearLastSync: () => setLastSync(null) };
}
