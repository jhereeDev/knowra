import * as Haptics from 'expo-haptics';

// Thin wrapper so swapping the implementation (or disabling per-user
// preference) is a one-line change later. Each call is fire-and-forget;
// failures (e.g. on web, or a device without a Taptic engine) are
// silently swallowed — haptics are an enhancement, never a feature.

export function swipeCommit(): void {
  void Haptics.selectionAsync().catch(() => {});
}

export function tapImpact(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function pressAndHold(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
