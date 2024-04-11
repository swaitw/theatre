import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import RoomToClick from '@theatre/studio/uiComponents/RoomToClick'
import useRefAndState from '@theatre/studio/utils/useRefAndState'
import {usePrism, useVal} from '@theatre/react'
import type {$IntentionalAny} from '@theatre/core/types/public'
import type {Pointer} from '@theatre/dataverse'
import {val} from '@theatre/dataverse'
import clamp from 'lodash-es/clamp'
import React, {useState} from 'react'
import styled from 'styled-components'
import {zIndexes} from '@theatre/studio/panels/SequenceEditorPanel/SequenceEditorPanel'
import {
  includeLockFrameStampAttrs,
  useLockFrameStampPosition,
} from '@theatre/studio/panels/SequenceEditorPanel/FrameStampPositionProvider'
import {pointerEventsAutoInNormalMode} from '@theatre/studio/css'
import BasicPopover from '@theatre/studio/uiComponents/Popover/BasicPopover'
import PlayheadPositionPopover from './PlayheadPositionPopover'
import {getIsPlayheadAttachedToFocusRange} from '@theatre/studio/UIRoot/useKeyboardShortcuts'
import {
  lockedCursorCssVarName,
  useCssCursorLock,
} from '@theatre/studio/uiComponents/PointerEventsHandler'
import getStudio from '@theatre/studio/getStudio'
import DopeSnap from './DopeSnap'
import {
  snapToAll,
  snapToNone,
} from '@theatre/studio/panels/SequenceEditorPanel/DopeSheet/Right/KeyframeSnapTarget'
import useChordial from '@theatre/studio/uiComponents/chordial/useChodrial'
import {mergeRefs} from 'react-merge-refs'
import usePopover from '@theatre/studio/uiComponents/Popover/usePopover'
import {generateSequenceMarkerId} from '@theatre/studio/utils/ids'

const Container = styled.div<{isVisible: boolean}>`
  --thumbColor: #00e0ff;
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  z-index: ${() => zIndexes.playhead};
  pointer-events: none;

  display: ${(props) => (props.isVisible ? 'block' : 'none')};
`

const Rod = styled.div`
  position: absolute;
  top: 8px;
  width: 0;
  height: calc(100% - 8px);
  border-left: 1px solid #27e0fd;
  z-index: 10;
  pointer-events: none;

  #pointer-root.draggingPositionInSequenceEditor &:not(.seeking) {
    /* pointer-events: auto; */
    /* cursor: var(${lockedCursorCssVarName}); */

    &:after {
      position: absolute;
      inset: -8px;
      display: block;
      content: ' ';
    }
  }
`

const Thumb = styled.div`
  background-color: var(--thumbColor);
  position: absolute;
  width: 5px;
  height: 13px;
  top: -4px;
  left: -2px;
  z-index: 11;
  cursor: ew-resize;
  --sunblock-color: #1f2b2b;

  ${pointerEventsAutoInNormalMode};

  ${Container}.seeking > &, ${Container}.popoverOpen > & {
    pointer-events: none !important;
  }

  #pointer-root.draggingPositionInSequenceEditor
    ${Container}:not(.seeking)
    > & {
    pointer-events: auto;
    cursor: var(${lockedCursorCssVarName});
  }

  ${Container}.playheadattachedtofocusrange > & {
    top: -8px;
    --sunblock-color: #005662;
    &:before,
    &:after {
      border-bottom-width: 8px;
    }
  }

  &:before {
    position: absolute;
    display: block;
    content: ' ';
    left: -2px;
    width: 0;
    height: 0;
    border-bottom: 4px solid var(--sunblock-color);
    border-left: 2px solid transparent;
  }

  &:after {
    position: absolute;
    display: block;
    content: ' ';
    right: -2px;
    width: 0;
    height: 0;
    border-bottom: 4px solid var(--sunblock-color);
    border-right: 2px solid transparent;
  }
`

const Squinch = styled.div`
  position: absolute;
  left: 1px;
  right: 1px;
  top: 13px;
  border-top: 3px solid var(--thumbColor);
  border-right: 1px solid transparent;
  border-left: 1px solid transparent;
  pointer-events: none;

  /* ${Container}.playheadattachedtofocusrange & {
    top: 10px;
    &:before,
    &:after {
      height: 15px;
    }
  } */

  &:before {
    position: absolute;
    display: block;
    content: ' ';
    top: -4px;
    left: -2px;
    height: 8px;
    width: 2px;
    background: none;
    border-radius: 0 100% 0 0;
    border-top: 1px solid var(--thumbColor);
    border-right: 1px solid var(--thumbColor);
  }

  &:after {
    position: absolute;
    display: block;
    content: ' ';
    top: -4px;
    right: -2px;
    height: 8px;
    width: 2px;
    background: none;
    border-radius: 100% 0 0 0;
    border-top: 1px solid var(--thumbColor);
    border-left: 1px solid var(--thumbColor);
  }
`

const Playhead: React.FC<{layoutP: Pointer<SequenceEditorPanelLayout>}> = ({
  layoutP,
}) => {
  const [thumbRef, thumbNode] = useRefAndState<HTMLElement | null>(null)

  const {
    isVisible,
    posInClippedSpace,
    isSeeking,
    isPlayheadAttachedToFocusRange,
    posInUnitSpace,
    sequence,
  } = usePrism(() => {
    const isSeeking = val(layoutP.seeker.isSeeking)

    const sequence = val(layoutP.sheet).getSequence()

    const isPlayheadAttachedToFocusRange = val(
      getIsPlayheadAttachedToFocusRange(sequence),
    )

    const posInUnitSpace = sequence.positionPrism.getValue()

    const posInClippedSpace = val(layoutP.clippedSpace.fromUnitSpace)(
      posInUnitSpace,
    )
    const isVisible =
      posInClippedSpace >= 0 &&
      posInClippedSpace <= val(layoutP.clippedSpace.width)

    return {
      isVisible,
      posInClippedSpace,
      isSeeking,
      isPlayheadAttachedToFocusRange,
      posInUnitSpace,
      sequence,
    }
  }, [layoutP])

  const [isDragging, setIsDragging] = useState(false)

  const c = useChordial(() => {
    return {
      title: sequence.positionFormatter.formatForPlayhead(
        sequence.closestGridPosition(posInUnitSpace),
      ),
      menuTitle: 'Playhead',
      invoke: (e) => {
        if (e?.type === 'MouseEvent') {
          popover.open(e.event, thumbRef.current!)
        }
      },
      items: [
        {
          type: 'normal',
          label: 'Place marker',
          callback: () => {
            getStudio().transaction(({stateEditors}) => {
              // only retrieve val on callback to reduce unnecessary work on every use
              const sheet = val(layoutP.sheet)
              const sheetSequence = sheet.getSequence()
              stateEditors.studio.historic.projects.stateByProjectId.stateBySheetId.sequenceEditor.replaceMarkers(
                {
                  sheetAddress: sheet.address,
                  markers: [
                    {
                      id: generateSequenceMarkerId(),
                      position: sheetSequence.position,
                    },
                  ],
                  snappingFunction: sheetSequence.closestGridPosition,
                },
              )
            })
          },
        },
      ],
      drag: {
        debugName: 'RightOverlay/Playhead',
        onDragStart() {
          const sequence = val(layoutP.sheet).getSequence()
          const posBeforeSeek = sequence.position
          const scaledSpaceToUnitSpace = val(layoutP.scaledSpace.toUnitSpace)

          const setIsSeeking = val(layoutP.seeker.setIsSeeking)
          setIsSeeking(true)
          setIsDragging(true)

          snapToAll()

          return {
            onDrag(dx, _, event) {
              const deltaPos = scaledSpaceToUnitSpace(dx)

              sequence.position =
                DopeSnap.checkIfMouseEventSnapToPos(event, {
                  ignore: thumbNode,
                }) ??
                // unsnapped
                clamp(posBeforeSeek + deltaPos, 0, sequence.length)
            },
            onDragEnd(dragHappened) {
              setIsSeeking(false)
              setIsDragging(false)
              snapToNone()
            },
          }
        },
      },
    }
  })

  useCssCursorLock(isDragging, 'draggingPositionInSequenceEditor', 'ew-resize')

  // hide the frame stamp when seeking
  useLockFrameStampPosition(useVal(layoutP.seeker.isSeeking) || isDragging, -1)

  const popover = usePopover({debugName: 'Playhead'}, () => {
    return (
      <BasicPopover showPopoverEdgeTriangle={true}>
        <PlayheadPositionPopover
          layoutP={layoutP}
          onRequestClose={popover.close}
        />
      </BasicPopover>
    )
  })

  c.useDisableTooltip(popover.isOpen)

  return (
    <>
      {popover.node}

      <Container
        isVisible={isVisible}
        style={{transform: `translate3d(${posInClippedSpace}px, 0, 0)`}}
        className={`${isSeeking && 'seeking'} ${
          popover.isOpen && 'popoverOpen'
        } ${isPlayheadAttachedToFocusRange && 'playheadattachedtofocusrange'}`}
        {...includeLockFrameStampAttrs('hide')}
      >
        <Thumb
          ref={mergeRefs([thumbRef, c.targetRef]) as $IntentionalAny}
          {...DopeSnap.includePositionSnapAttrs(posInUnitSpace)}
        >
          <RoomToClick room={8} />
          <Squinch />
        </Thumb>

        <Rod
          {...DopeSnap.includePositionSnapAttrs(posInUnitSpace)}
          className={isSeeking ? 'seeking' : ''}
        />
      </Container>
    </>
  )
}

export default Playhead
