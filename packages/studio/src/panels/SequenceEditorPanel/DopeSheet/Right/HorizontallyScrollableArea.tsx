import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import useDrag from '@theatre/studio/uiComponents/useDrag'
import useRefAndState from '@theatre/studio/utils/useRefAndState'
import {usePrism} from '@theatre/react'
import type {Pointer} from '@theatre/dataverse'
import {prism, val} from '@theatre/dataverse'
import {clamp} from 'lodash-es'
import React, {useLayoutEffect, useMemo} from 'react'
import styled from 'styled-components'
import {useReceiveVerticalWheelEvent} from '@theatre/studio/panels/SequenceEditorPanel/VerticalScrollContainer'
import {pointerEventsAutoInNormalMode} from '@theatre/studio/css'
import {useCssCursorLock} from '@theatre/studio/uiComponents/PointerEventsHandler'
import type {IRange} from '@theatre/core/types/public'
import DopeSnap from '@theatre/studio/panels/SequenceEditorPanel/RightOverlay/DopeSnap'
import {snapToAll, snapToNone} from './KeyframeSnapTarget'

const Container = styled.div`
  position: absolute;

  right: 0;
  overflow-x: scroll;
  overflow-y: hidden;
  ${pointerEventsAutoInNormalMode};

  // hide the scrollbar on Gecko
  scrollbar-width: none;

  // hide the scrollbar on Webkit/Blink
  &::-webkit-scrollbar {
    display: none;
  }
`

const HorizontallyScrollableArea: React.FC<{
  layoutP: Pointer<SequenceEditorPanelLayout>
  height: number
  children: React.ReactNode
}> = React.memo(({layoutP, children, height}) => {
  const {width, unitSpaceToScaledSpaceMultiplier} = usePrism(
    () => ({
      width: val(layoutP.rightDims.width),
      unitSpaceToScaledSpaceMultiplier: val(layoutP.scaledSpace.fromUnitSpace)(
        1,
      ),
    }),
    [layoutP],
  )

  const [containerRef, containerNode] = useRefAndState<HTMLDivElement | null>(
    null,
  )

  useHandlePanAndZoom(layoutP, containerNode)
  useDragPlayheadHandlers(layoutP, containerNode)
  useUpdateScrollFromClippedSpaceRange(layoutP, containerNode)

  return (
    <Container
      ref={containerRef}
      style={{
        width: width + 'px',
        height: height + 'px',
        // @ts-expect-error
        '--unitSpaceToScaledSpaceMultiplier': unitSpaceToScaledSpaceMultiplier,
      }}
    >
      {children}
    </Container>
  )
})

export default HorizontallyScrollableArea

function useDragPlayheadHandlers(
  layoutP: Pointer<SequenceEditorPanelLayout>,
  containerEl: HTMLDivElement | null,
) {
  const handlers = useMemo((): Parameters<typeof useDrag>[1] => {
    return {
      debugName: 'HorizontallyScrollableArea',
      onDragStart(event) {
        if (event.target instanceof HTMLInputElement) {
          // editing some value
          return false
        }
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          // e.g. marquee selection has shiftKey
          return false
        }
        if (
          event
            .composedPath()
            .some((el) => el instanceof HTMLElement && el.draggable === true)
        ) {
          // Question: I think to check if we want another descendent element
          // to be able to take control of this drag event.
          // Question: e.g. for `useDragKeyframe`?
          return false
        }

        const initialPositionInClippedSpace =
          event.clientX - containerEl!.getBoundingClientRect().left

        const initialPositionInUnitSpace = clamp(
          val(layoutP.clippedSpace.toUnitSpace)(initialPositionInClippedSpace),
          0,
          Infinity,
        )

        const setIsSeeking = val(layoutP.seeker.setIsSeeking)

        const sequence = val(layoutP.sheet).getSequence()

        sequence.position = initialPositionInUnitSpace

        const posBeforeSeek = initialPositionInUnitSpace
        const scaledSpaceToUnitSpace = val(layoutP.scaledSpace.toUnitSpace)
        setIsSeeking(true)

        snapToAll()

        return {
          onDrag(dx: number, _, event) {
            const deltaPos = scaledSpaceToUnitSpace(dx)
            const unsnappedPos = clamp(
              posBeforeSeek + deltaPos,
              0,
              sequence.length,
            )

            let newPosition = unsnappedPos

            const snapPos = DopeSnap.checkIfMouseEventSnapToPos(event, {})
            if (snapPos != null) {
              newPosition = snapPos
            }

            sequence.position = newPosition
          },
          onDragEnd() {
            setIsSeeking(false)
            snapToNone()
          },
        }
      },
    }
  }, [layoutP, containerEl])

  const [isDragging] = useDrag(containerEl, handlers)

  useCssCursorLock(isDragging, 'draggingPositionInSequenceEditor', 'ew-resize')
}

function useHandlePanAndZoom(
  layoutP: Pointer<SequenceEditorPanelLayout>,
  node: HTMLDivElement | null,
) {
  const receiveVerticalWheelEvent = useReceiveVerticalWheelEvent()
  useLayoutEffect(() => {
    if (!node) return

    const receiveWheelEvent = (event: WheelEvent) => {
      // pinch
      if (event.ctrlKey) {
        event.preventDefault()
        event.stopPropagation()

        const pivotPointInClippedSpace =
          event.clientX - node.getBoundingClientRect().left

        const pivotPointInUnitSpace = val(layoutP.clippedSpace.toUnitSpace)(
          pivotPointInClippedSpace,
        )

        const oldRange = val(layoutP.clippedSpace.range)
        const delta = normalize(event.deltaY, [-50, 50])
        const scaleFactor = 1 + delta * 0.03

        const newRange = oldRange.map((originalPos) => {
          return (
            (originalPos - pivotPointInUnitSpace) * scaleFactor +
            pivotPointInUnitSpace
          )
        }) as IRange

        // Set maximum scroll points based on the sequence length.
        // This is to avoid zooming out to infinity.
        const sequenceLength = val(layoutP.sheet).getSequence().length
        const maxEnd = sequenceLength + sequenceLength * 0.25

        val(layoutP.clippedSpace.setRange)(
          normalizeRange(newRange, [0, maxEnd]),
        )
        return
      }
      // panning
      else if (event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()

        const sequenceLength = val(layoutP.sheet).getSequence().length
        const oldRange = val(layoutP.clippedSpace.range)
        const windowSize = oldRange[1] - oldRange[0]
        const speed = windowSize / sequenceLength

        // if there's no deltaY, the browser is probably assigning to deltaX because of the shiftKey
        // it appeared that Safari + Chrome continue to use deltaY with shiftKey, while FF on macOS
        // updates the deltaX with deltaY unchanged.
        // this is a little awkward with track pads + shift on macOS FF, but that's not a big deal
        // since scrolling horizontally with macOS track pads is not necessary to hold shift.
        const delta = normalize(event.deltaY || event.deltaX, [-50, 50])
        const scaleFactor = delta * 0.05 * speed

        const newRange = oldRange.map(
          (originalPos) => originalPos + scaleFactor,
        ) as IRange

        val(layoutP.clippedSpace.setRange)(newRange)
        return
      } else {
        receiveVerticalWheelEvent(event)
        event.preventDefault()
        event.stopPropagation()

        const scaledSpaceToUnitSpace = val(layoutP.scaledSpace.toUnitSpace)
        const deltaPos = scaledSpaceToUnitSpace(event.deltaX * 1)
        const oldRange = val(layoutP.clippedSpace.range)
        const newRange = oldRange.map((p) => p + deltaPos) as IRange

        const setRange = val(layoutP.clippedSpace.setRange)

        setRange(newRange)

        return
      }
    }

    const listenerOptions = {
      capture: true,
      passive: false,
    }
    node.addEventListener('wheel', receiveWheelEvent, listenerOptions)

    return () => {
      node.removeEventListener('wheel', receiveWheelEvent, listenerOptions)
    }
  }, [node, layoutP])

  useDrag(
    node,
    useMemo<Parameters<typeof useDrag>[1]>(() => {
      return {
        onDragStart(e) {
          const oldRange = val(layoutP.clippedSpace.range)
          const setRange = val(layoutP.clippedSpace.setRange)
          const scaledSpaceToUnitSpace = val(layoutP.scaledSpace.toUnitSpace)
          e.preventDefault()
          e.stopPropagation()

          return {
            onDrag(dx, dy, _, __, deltaYFromLastEvent) {
              receiveVerticalWheelEvent({deltaY: -deltaYFromLastEvent})
              const delta = -scaledSpaceToUnitSpace(dx)

              const newRange = oldRange.map(
                (originalPos) => originalPos + delta,
              ) as IRange

              setRange(newRange)
            },
          }
        },

        debugName: 'HorizontallyScrollableArea Middle Button Drag',
        buttons: [1],
        lockCSSCursorTo: 'grabbing',
      }
    }, [layoutP]),
  )
}

function normalize(value: number, [min, max]: [min: number, max: number]) {
  return Math.max(Math.min(value, max), min)
}

function normalizeRange(
  range: IRange,
  minMax: [min: number, max: number],
): IRange {
  return [normalize(range[0], minMax), normalize(range[1], minMax)]
}

function useUpdateScrollFromClippedSpaceRange(
  layoutP: Pointer<SequenceEditorPanelLayout>,
  node: HTMLDivElement | null,
) {
  useLayoutEffect(() => {
    if (!node) return

    const d = prism(() => {
      const range = val(layoutP.clippedSpace.range)
      const rangeStartInScaledSpace = val(layoutP.scaledSpace.fromUnitSpace)(
        range[0],
      )

      return rangeStartInScaledSpace
    })

    const update = () => {
      const rangeStartInScaledSpace = d.getValue()
      node.scrollLeft = rangeStartInScaledSpace
    }
    const untap = d.onStale(update)

    update()
    const timeout = setTimeout(update, 100)

    return () => {
      clearTimeout(timeout)
      untap()
    }
  }, [layoutP, node])
}
