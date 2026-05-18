// Thin wrapper around Expo's push send API. We don't pull in
// `expo-server-sdk` because it's CommonJS-only and ships its own
// retry/queue layer we don't want — a tiny fetch wrapper covers our
// needs and stays type-safe.
//
// Spec: https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100; // Expo's hard limit per request

export type ExpoPushMessage = {
  to: string; // ExponentPushToken[xxxxxxx]
  title: string;
  body: string;
  // Arbitrary client-side payload — the mobile listener reads `data.wikiId`.
  data?: Record<string, unknown>;
  // We never play a sound (anti-pattern in product spec) and never
  // set a badge until we have a real unread model. Leaving the fields
  // off the type so callers can't accidentally enable them.
};

type ExpoTicketOk = {
  status: 'ok';
  id: string;
};

type ExpoTicketError = {
  status: 'error';
  message: string;
  details?: {
    error?: string; // 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials'
  };
};

type ExpoTicket = ExpoTicketOk | ExpoTicketError;

export type SendResult = {
  total: number;
  ok: number;
  failed: number;
  // Tokens that should be removed from the DB — DeviceNotRegistered means
  // the user uninstalled the app or revoked notifications. The caller
  // should null these in the `devices` table so we stop sending.
  staleTokens: string[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send one push per message. Batches up to 100 per HTTP call. Returns
 * aggregate counts and the list of tokens that should be retired from
 * the DB. Network errors per-batch are logged and counted as failures
 * but don't throw — partial-success is the right shape for a fan-out job.
 */
export async function sendPushes(messages: ExpoPushMessage[]): Promise<SendResult> {
  const result: SendResult = { total: messages.length, ok: 0, failed: 0, staleTokens: [] };
  if (messages.length === 0) return result;

  for (const batch of chunk(messages, MAX_BATCH_SIZE)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // gzip identifies us cleanly in Expo's logs — small but worth it
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        // Whole batch failed (typically 5xx). Count all as failed, don't
        // mark any as stale — we don't know which tokens were the cause.
        result.failed += batch.length;
        continue;
      }
      const json = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown[] };
      const tickets = json.data ?? [];
      // Tickets come back in the same order as the request.
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          result.ok += 1;
          return;
        }
        result.failed += 1;
        // The two errors worth acting on:
        //   DeviceNotRegistered — user uninstalled / revoked. Retire token.
        //   InvalidCredentials — our key is wrong. Doesn't apply per-token;
        //                        logged as a generic failure.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const token = batch[i]?.to;
          if (token) result.staleTokens.push(token);
        }
      });
    } catch {
      // Network failure for the whole batch — count as failed, no
      // staleness signal since we never got a response.
      result.failed += batch.length;
    }
  }

  return result;
}
