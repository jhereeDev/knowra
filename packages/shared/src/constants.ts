export const KNOWRA_VERSION = '0.0.1';

export const WIKIPEDIA_USER_AGENT_PREFIX = 'Knowra';

export const FEEDS = ['random', 'foryou', 'today'] as const;
export type FeedType = (typeof FEEDS)[number];

export const EVENT_TYPES = [
  'impression',
  'swipe_up',
  'swipe_back',
  'save',
  'share',
  'go_deeper',
  'quick_skip',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
