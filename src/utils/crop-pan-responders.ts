import {
  PanResponder,
  type PanResponderInstance,
} from 'react-native';

import {
  NormalizedCrop,
  normalizeCrop,
} from '@/services/imageProcessingService';

export type CropMode =
  | 'move'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

export type CropFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropUpdater = (crop: NormalizedCrop) => NormalizedCrop;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resizeCrop = (
  mode: CropMode,
  start: NormalizedCrop,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number
): NormalizedCrop => {
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  if (mode === 'move') {
    x = clamp(start.x + dx, 0, 1 - start.width);
    y = clamp(start.y + dy, 0, 1 - start.height);
  }

  if (mode === 'left' || mode === 'topLeft' || mode === 'bottomLeft') {
    x = clamp(start.x + dx, 0, right - minWidth);
    width = right - x;
  }

  if (mode === 'right' || mode === 'topRight' || mode === 'bottomRight') {
    width = clamp(start.width + dx, minWidth, 1 - start.x);
  }

  if (mode === 'top' || mode === 'topLeft' || mode === 'topRight') {
    y = clamp(start.y + dy, 0, bottom - minHeight);
    height = bottom - y;
  }

  if (mode === 'bottom' || mode === 'bottomLeft' || mode === 'bottomRight') {
    height = clamp(start.height + dy, minHeight, 1 - start.y);
  }

  return normalizeCrop({
    x,
    y,
    width,
    height,
  });
};

export const createCropPanResponders = (
  frame: CropFrame | null,
  onChange: (updater: CropUpdater) => void
) => {
  const createResponder = (mode: CropMode) => {
    let lastDx = 0;
    let lastDy = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(frame),
      onMoveShouldSetPanResponder: () => Boolean(frame),
      onPanResponderGrant: () => {
        lastDx = 0;
        lastDy = 0;
      },
      onPanResponderMove: (_event, gesture) => {
        if (!frame) {
          return;
        }

        const dx = (gesture.dx - lastDx) / frame.width;
        const dy = (gesture.dy - lastDy) / frame.height;

        lastDx = gesture.dx;
        lastDy = gesture.dy;

        onChange((current) =>
          resizeCrop(
            mode,
            current,
            dx,
            dy,
            Math.min(0.5, 38 / frame.width),
            Math.min(0.5, 38 / frame.height)
          )
        );
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  };

  return {
    move: createResponder('move'),
    topLeft: createResponder('topLeft'),
    topRight: createResponder('topRight'),
    bottomLeft: createResponder('bottomLeft'),
    bottomRight: createResponder('bottomRight'),
    top: createResponder('top'),
    bottom: createResponder('bottom'),
    left: createResponder('left'),
    right: createResponder('right'),
  } as Record<CropMode, PanResponderInstance>;
};
