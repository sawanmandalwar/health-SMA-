import { useSyncExternalStore } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';

const EMPTY_DIMENSIONS: ScaledSize = {
  width: 0,
  height: 0,
  scale: 1,
  fontScale: 1,
};

const subscribe = () => () => {};

const getSnapshot = () => true;

const getServerSnapshot = () => false;

/**
 * Web hydration-safe replacement for `useWindowDimensions`.
 *
 * Expo static exports render screens on the server where the viewport width is
 * 0. React reuses that markup during hydration, so if the first client render
 * immediately reports the real width, attribute changes are skipped and the
 * desktop layout never paints. Using the server snapshot for the first client
 * render keeps hydration identical and lets React re-render afterwards.
 */
export function useResponsiveDimensions(): ScaledSize {
  const dimensions = useWindowDimensions();
  const hydrated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return hydrated ? dimensions : EMPTY_DIMENSIONS;
}
