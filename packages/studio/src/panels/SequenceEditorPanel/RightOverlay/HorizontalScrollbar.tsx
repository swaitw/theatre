import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import {useVal} from '@theatre/react'
import type {IRange} from '@theatre/core/types/public'
import type {Pointer} from '@theatre/dataverse'
import {prism, val} from '@theatre/dataverse'
import {position} from 'polished'
import React, {useCallback, useMemo, useState} from 'react'
import styled from 'styled-components'
import {zIndexes} from '@theatre/studio/panels/SequenceEditorPanel/SequenceEditorPanel'
import {includeLockFrameStampAttrs} from '@theatre/studio/panels/SequenceEditorPanel/FrameStampPositionProvider'
import {pointerEventsAutoInNormalMode} from '@theatre/studio/css'
import useDrag from '@theatre/studio/uiComponents/useDrag'

const Container = styled.div`
  --threadHeight: 6px;
  --bg-inactive: #32353b;
  --bg-active: #5b5c5d;
  position: absolute;
  height: 0;
  width: 100%;
  left: 12px;
  /* bottom: 8px; */
  z-index: ${() => zIndexes.horizontalScrollbar};
  ${pointerEventsAutoInNormalMode}
`

const TimeThread = styled.div`
  position: relative;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--threadHeight);
`

const RangeBar = styled.div`
  position: absolute;
  height: 5px;
  background: var(--bg-inactive);
  cursor: ew-resize;
  z-index: 2;

  &:hover,
  &:active {
    background: var(--bg-active);
  }

  &:after {
    ${position('absolute', '-4px')};
    display: block;
    content: ' ';
  }
`

const RangeHandle = styled.div`
  position: absolute;
  height: 5px;
  width: 7px;
  left: 0;
  z-index: 2;
  top: 0;
  bottom: 0;
  display: block;

  &:hover:before {
    background: var(--bg-active);
  }

  &:before {
    ${position('absolute', '0')};
    display: block;
    content: ' ';
    background: var(--bg-inactive);
    border-radius: 0 2px 2px 0;
  }

  &:after {
    ${position('absolute', '-4px')};
    display: block;
    content: ' ';
  }
`

const RangeStartHandle = styled(RangeHandle)`
  left: calc(-1 * 7px);
  cursor: w-resize;
  &:before {
    transform: scaleX(-1);
  }
`
const RangeEndHandle = styled(RangeHandle)`
  cursor: e-resize;
  left: 0px;
`

const Tooltip = styled.div<{active: boolean}>`
  display: ${(props) => (props.active ? 'block' : 'none')};
  position: absolute;
  top: -20px;
  left: 4px;
  padding: 0 4px;
  transform: translateX(-50%);
  background: #131d1f;
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;

  ${RangeStartHandle}:hover &,
  ${RangeEndHandle}:hover &,
  ${RangeBar}:hover ~ ${RangeStartHandle} &,
  ${RangeBar}:hover ~ ${RangeEndHandle} & {
    display: block;
  }
`

/**
 * The little scrollbar on the bottom of the Right side
 */
const HorizontalScrollbar: React.FC<{
  layoutP: Pointer<SequenceEditorPanelLayout>
}> = ({layoutP}) => {
  const unitPosToHumanReadablePos = useCallback((n: number) => n.toFixed(2), [])

  // const dd = usePrism(() => val(layoutP.sheet).getSequence().positionFormatter.formatForPlayhead, [layoutP])

  const relevantValuesD = useMemo(
    () =>
      prism(() => {
        const rightWidth = val(layoutP.rightDims.width) - 25
        const clippedSpaceRange = val(layoutP.clippedSpace.range)
        const sequenceLength = val(layoutP.sheet).getSequence().length

        const assumedLengthOfSequence = Math.max(
          clippedSpaceRange[1],
          sequenceLength,
        )

        const rangeStartX =
          (clippedSpaceRange[0] / assumedLengthOfSequence) * rightWidth

        const rangeEndX =
          (clippedSpaceRange[1] / assumedLengthOfSequence) * rightWidth

        return {
          rightWidth,
          clippedSpaceRange,
          sequenceLength,
          assumedLengthOfSequence,
          rangeStartX,
          rangeEndX,
          bottom: val(layoutP.horizontalScrollbarDims.bottom),
        }
      }),
    [layoutP],
  )
  const {rangeStartX, rangeEndX, clippedSpaceRange, bottom} =
    useVal(relevantValuesD)

  const [beingDragged, setBeingDragged] = useState<
    'nothing' | 'both' | 'start' | 'end'
  >('nothing')

  const handles = useMemo(() => {
    let valuesBeforeDrag = val(relevantValuesD)
    let noteValuesBeforeDrag = () => {
      valuesBeforeDrag = val(relevantValuesD)
    }

    const deltaXToDeltaPos = (dx: number): number => {
      const asAFractionOfRightWidth = dx / valuesBeforeDrag.rightWidth
      return asAFractionOfRightWidth * valuesBeforeDrag.assumedLengthOfSequence
    }

    const self = {
      onRangeDragStart() {
        noteValuesBeforeDrag()
        return {
          onDrag(dx: number) {
            setBeingDragged('both')
            const deltaPosInUnitSpace = deltaXToDeltaPos(dx)

            const newRange = valuesBeforeDrag.clippedSpaceRange.map(
              (p) => p + deltaPosInUnitSpace,
            ) as IRange

            val(layoutP.clippedSpace.setRange)(newRange)
          },
          onDragEnd() {
            setBeingDragged('nothing')
          },
        }
      },

      onRangeStartDragStart() {
        noteValuesBeforeDrag()
        return {
          onDrag(dx: number) {
            setBeingDragged('start')

            const deltaPosInUnitSpace = deltaXToDeltaPos(dx)

            const newRange: IRange = [
              valuesBeforeDrag.clippedSpaceRange[0] + deltaPosInUnitSpace,
              valuesBeforeDrag.clippedSpaceRange[1],
            ]

            if (newRange[0] > newRange[1] - 1) {
              newRange[0] = newRange[1] - 1
            }

            if (newRange[0] <= 0) {
              newRange[0] = 0
            }

            val(layoutP.clippedSpace.setRange)(newRange)
          },
          onDragEnd() {
            setBeingDragged('nothing')
          },
        }
      },

      onRangeEndDragStart() {
        noteValuesBeforeDrag()
        return {
          onDrag(dx: number) {
            setBeingDragged('end')

            const deltaPosInUnitSpace = deltaXToDeltaPos(dx)

            const newRange: IRange = [
              valuesBeforeDrag.clippedSpaceRange[0],
              valuesBeforeDrag.clippedSpaceRange[1] + deltaPosInUnitSpace,
            ]

            if (newRange[1] < newRange[0] + 1) {
              newRange[1] = newRange[0] + 1
            }

            if (newRange[1] >= valuesBeforeDrag.assumedLengthOfSequence) {
              newRange[1] = valuesBeforeDrag.assumedLengthOfSequence
            }

            val(layoutP.clippedSpace.setRange)(newRange)
          },
          onDragEnd() {
            setBeingDragged('nothing')
          },
        }
      },
    }

    return self
  }, [layoutP, relevantValuesD])

  const [rangeDragNode, setRangeDragNode] = useState<HTMLDivElement | null>(
    null,
  )
  useDrag(rangeDragNode, {
    debugName: 'HorizontalScrollbar/onRangeDrag',
    onDragStart: handles.onRangeDragStart,
    lockCSSCursorTo: 'ew-resize',
  })

  const [rangeStartDragNode, setRangeStartDragNode] =
    useState<HTMLDivElement | null>(null)
  useDrag(rangeStartDragNode, {
    debugName: 'HorizontalScrollbar/onRangeStartDrag',
    onDragStart: handles.onRangeStartDragStart,
    lockCSSCursorTo: 'w-resize',
  })

  const [rangeEndDragNode, setRangeEndDragNode] =
    useState<HTMLDivElement | null>(null)
  useDrag(rangeEndDragNode, {
    debugName: 'HorizontalScrollbar/onRangeEndDrag',
    onDragStart: handles.onRangeEndDragStart,
    lockCSSCursorTo: 'e-resize',
  })

  return (
    <Container
      style={{bottom: bottom + 8 + 'px'}}
      {...includeLockFrameStampAttrs('hide')}
    >
      <TimeThread>
        <RangeBar
          ref={setRangeDragNode}
          style={{
            width: `${rangeEndX - rangeStartX}px`,
            transform: `translate3d(${rangeStartX}px, 0, 0)`,
          }}
        />
        <RangeStartHandle
          ref={setRangeStartDragNode}
          style={{transform: `translate3d(${rangeStartX}px, 0, 0)`}}
        >
          <Tooltip active={beingDragged === 'both' || beingDragged === 'start'}>
            {unitPosToHumanReadablePos(clippedSpaceRange[0])}
          </Tooltip>
        </RangeStartHandle>
        <RangeEndHandle
          ref={setRangeEndDragNode}
          style={{transform: `translate3d(${rangeEndX}px, 0, 0)`}}
        >
          <Tooltip active={beingDragged === 'both' || beingDragged === 'end'}>
            {unitPosToHumanReadablePos(clippedSpaceRange[1])}
          </Tooltip>
        </RangeEndHandle>
      </TimeThread>
    </Container>
  )
}

export default HorizontalScrollbar
