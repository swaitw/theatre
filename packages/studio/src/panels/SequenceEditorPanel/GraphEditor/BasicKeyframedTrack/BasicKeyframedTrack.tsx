import type {TrackData} from '@theatre/core/types/private/core'
import type SheetObject from '@theatre/core/sheetObjects/SheetObject'
import type {PathToProp} from '@theatre/utils/pathToProp'
import {createStudioSheetItemKey} from '@theatre/studio/utils/createStudioSheetItemKey'
import type {
  $IntentionalAny,
  BasicKeyframe,
  VoidFn,
} from '@theatre/core/types/public'
import type {Pointer} from '@theatre/dataverse'
import React, {useMemo, useRef, useState} from 'react'
import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import KeyframeEditor from './KeyframeEditor/KeyframeEditor'
import {__private} from '@theatre/core'
import type {
  PropTypeConfig_AllSimples,
  SequenceTrackId,
} from '@theatre/core/types/public'
import {useVal} from '@theatre/react'
import type {GraphEditorColors} from '@theatre/core/types/private'
import {graphEditorColors} from '@theatre/sync-server/state/schema'

const {getPropConfigByPath, isPropConfigComposite, valueInProp} =
  __private.propTypeUtils

const {keyframeUtils} = __private

export type ExtremumSpace = {
  fromValueSpace: (v: number) => number
  toValueSpace: (v: number) => number
  deltaToValueSpace: (v: number) => number
  lock(): VoidFn
}

const BasicKeyframedTrack: React.VFC<{
  layoutP: Pointer<SequenceEditorPanelLayout>
  sheetObject: SheetObject
  pathToProp: PathToProp
  trackId: SequenceTrackId
  trackData: TrackData
  color: keyof GraphEditorColors
}> = React.memo(
  ({layoutP, trackData, sheetObject, trackId, color, pathToProp}) => {
    const propConfig = getPropConfigByPath(
      useVal(sheetObject.template.configPointer),
      pathToProp,
    )! as PropTypeConfig_AllSimples

    if (isPropConfigComposite(propConfig)) {
      console.error(`Composite prop types cannot be keyframed`)
      return <></>
    }

    const [areExtremumsLocked, setAreExtremumsLocked] = useState<boolean>(false)
    const lockExtremums = useMemo(() => {
      const locks = new Set<VoidFn>()
      return function lockExtremums() {
        const shouldLock = locks.size === 0
        locks.add(unlock)
        if (shouldLock) setAreExtremumsLocked(true)

        function unlock() {
          const wasLocked = locks.size > 0
          locks.delete(unlock)
          if (wasLocked && locks.size === 0) setAreExtremumsLocked(false)
        }

        return unlock
      }
    }, [])

    const extremumSpace: ExtremumSpace = useMemo(() => {
      const sortedKeyframes = keyframeUtils.getSortedKeyframesCached(
        trackData.keyframes,
      )
      const extremums =
        propConfig.type === 'number'
          ? calculateScalarExtremums(sortedKeyframes, propConfig)
          : calculateNonScalarExtremums(sortedKeyframes)

      const fromValueSpace = (val: number): number =>
        (val - extremums[0]) / (extremums[1] - extremums[0])

      const toValueSpace = (ex: number): number =>
        extremums[0] + deltaToValueSpace(ex)

      const deltaToValueSpace = (ex: number): number =>
        ex * (extremums[1] - extremums[0])

      return {
        fromValueSpace,
        toValueSpace,
        deltaToValueSpace,
        lock: lockExtremums,
      }
    }, [trackData.keyframes])

    const cachedExtremumSpace = useRef<ExtremumSpace>(
      undefined as $IntentionalAny,
    )
    if (!areExtremumsLocked) {
      cachedExtremumSpace.current = extremumSpace
    }

    const sortedKeyframes = keyframeUtils.getSortedKeyframesCached(
      trackData.keyframes,
    )

    const keyframeEditors = sortedKeyframes.map((kf, index) => (
      <KeyframeEditor
        pathToProp={pathToProp}
        propConfig={propConfig}
        itemKey={createStudioSheetItemKey.forTrackKeyframe(
          sheetObject,
          trackId,
          kf.id,
        )}
        keyframe={kf}
        index={index}
        trackData={trackData}
        layoutP={layoutP}
        sheetObject={sheetObject}
        trackId={trackId}
        isScalar={propConfig.type === 'number'}
        key={kf.id}
        extremumSpace={cachedExtremumSpace.current}
        color={color}
      />
    ))

    const iconColor = graphEditorColors[color].iconColor

    return (
      <g
        style={{
          // @ts-ignore
          '--main-color': iconColor,
        }}
      >
        {keyframeEditors}
      </g>
    )
  },
)

export default BasicKeyframedTrack

type Extremums = [min: number, max: number]

function calculateScalarExtremums(
  keyframes: BasicKeyframe[],
  propConfig: PropTypeConfig_AllSimples,
): Extremums {
  let min = Infinity,
    max = -Infinity

  function check(n: number): void {
    min = Math.min(n, min)
    max = Math.max(n, max)
  }

  keyframes.forEach((cur, i) => {
    const curVal = valueInProp(cur.value, propConfig) as number
    check(curVal)
    if (!cur.connectedRight) return
    const next = keyframes[i + 1]
    if (!next) return
    const diff = (typeof next.value === 'number' ? next.value : 1) - curVal
    check(curVal + cur.handles[3] * diff)
    check(curVal + next.handles[1] * diff)
  })

  return [min, max]
}

function calculateNonScalarExtremums(keyframes: BasicKeyframe[]): Extremums {
  let min = 0,
    max = 1

  function check(n: number): void {
    min = Math.min(n, min)
    max = Math.max(n, max)
  }

  keyframes.forEach((cur, i) => {
    if (!cur.connectedRight) return
    const next = keyframes[i + 1]
    if (!next) return
    check(cur.handles[3])
    check(next.handles[1])
  })

  return [min, max]
}
