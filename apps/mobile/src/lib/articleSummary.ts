import {
  articleSummaryResponseSchema,
  type ArticleSummaryResponse,
} from '@knowra/shared';
import { getDeviceId } from './device';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Fetch the AI-generated 300-word summary for a Wikipedia article.
 *
 * First call for a given article hits the LLM (~2-3s); every subsequent
 * call returns the persisted row instantly. Throws on network failure or
 * schema mismatch — callers should render an error state.
 */
export async function fetchArticleSummary(
  wikiId: string,
): Promise<ArticleSummaryResponse> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${API_URL}/api/cards/${wikiId}/summary`, {
    headers: { 'X-Knowra-Device-Id': deviceId },
  });
  if (!res.ok) {
    throw new Error(`summary fetch failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return articleSummaryResponseSchema.parse(json);
}
