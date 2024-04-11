import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import type {Pointer} from '@theatre/dataverse'
import {Atom} from '@theatre/dataverse'
import {val} from '@theatre/dataverse'
import React from 'react'
import styled from 'styled-components'
import {DopeSnapHitZoneUI} from '@theatre/studio/panels/SequenceEditorPanel/RightOverlay/DopeSnapHitZoneUI'
import type {
  BasicKeyframe,
  ObjectAddressKey,
  SequenceTrackId,
} from '@theatre/core/types/public'
import type {
  BasicKeyframedTrack,
  HistoricPositionalSequence,
} from '@theatre/core/types/private/core'
import {__private} from '@theatre/core'

const {keyframeUtils} = __private

const HitZone = styled.div`
  z-index: 1;
  cursor: ew-resize;

  ${DopeSnapHitZoneUI.CSS}

  #pointer-root.draggingPositionInSequenceEditor & {
    ${DopeSnapHitZoneUI.CSS_WHEN_SOMETHING_DRAGGING}
  }
`

const Container = styled.div`
  position: absolute;
`

export type ISnapTargetPRops = {
  layoutP: Pointer<SequenceEditorPanelLayout>
  leaf: {nodeHeight: number}
  position: number
}

const KeyframeSnapTarget: React.VFC<ISnapTargetPRops> = (props) => {
  return (
    <Container
      style={{
        top: `${props.leaf.nodeHeight / 2}px`,
        left: `calc(${val(
          props.layoutP.scaledSpace.leftPadding,
        )}px + calc(var(--unitSpaceToScaledSpaceMultiplier) * ${
          props.position
        }px))`,
      }}
    >
      <HitZone
        {...DopeSnapHitZoneUI.reactProps({
          isDragging: false,
          position: props.position,
        })}
      />
    </Container>
  )
}

export default KeyframeSnapTarget

export type KeyframeSnapPositions = {
  [objectKey: ObjectAddressKey]: {
    [trackId: SequenceTrackId]: number[]
  }
}

const stateB = new Atom<
  | {
      // all keyframes must be snap targets
      mode: 'snapToAll'
    }
  | {
      // only these keyframes must be snap targets
      mode: 'snapToSome'
      positions: KeyframeSnapPositions
    }
  | {
      // no keyframe should be a snap target
      mode: 'snapToNone'
    }
>({mode: 'snapToNone'})

export const snapPositionsStateD = stateB.prism

export function snapToAll() {
  stateB.set({mode: 'snapToAll'})
}

export function snapToNone() {
  stateB.set({mode: 'snapToNone'})
}

export function snapToSome(positions: KeyframeSnapPositions) {
  stateB.set({mode: 'snapToSome', positions})
}

export function collectKeyframeSnapPositions(
  tracksByObject: HistoricPositionalSequence['tracksByObject'],
  shouldIncludeKeyframe: (
    kf: BasicKeyframe,
    track: {
      trackId: SequenceTrackId
      trackData: BasicKeyframedTrack
      objectKey: ObjectAddressKey
    },
  ) => boolean,
): KeyframeSnapPositions {
  return Object.fromEntries(
    Object.entries(tracksByObject).map(
      ([objectKey, trackDataAndTrackIdByPropPath]) => [
        objectKey,
        Object.fromEntries(
          Object.entries(trackDataAndTrackIdByPropPath!.trackData).map(
            ([trackId, track]) => [
              trackId,
              keyframeUtils
                .getSortedKeyframesCached(track!.keyframes)
                .filter((kf) =>
                  shouldIncludeKeyframe(kf, {
                    trackId,
                    trackData: track!,
                    objectKey,
                  }),
                )
                .map((keyframe) => keyframe.position),
            ],
          ),
        ),
      ],
    ),
  )
}
