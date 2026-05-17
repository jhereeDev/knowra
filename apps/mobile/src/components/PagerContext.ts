import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

// Lets CardView (or any pager item) read the pager's animated translateY
// without prop-drilling through renderItem. Used for image parallax —
// the hero image transforms at a fraction of the pager's rate to give
// a subtle depth effect during swipes.

type PagerContextValue = {
  translateY: SharedValue<number>;
};

export const PagerContext = createContext<PagerContextValue | null>(null);

export function usePagerTranslateY(): SharedValue<number> | null {
  const ctx = useContext(PagerContext);
  return ctx?.translateY ?? null;
}
