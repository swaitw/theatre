import type {
  PropTypeConfig_Compound,
  PropTypeConfig_Number,
} from '@theatre/core/types/public'

import type {$FixMe} from '@theatre/core/types/public'
import {Atom, getPointerParts} from '@theatre/dataverse'
import type {Pointer} from '@theatre/dataverse'
import last from 'lodash-es/last'
import {darken, transparentize} from 'polished'
import React, {useMemo} from 'react'
import styled from 'styled-components'
import {rowIndentationFormulaCSS} from '@theatre/studio/panels/DetailPanel/DeterminePropEditorForDetail/rowIndentationFormulaCSS'
import {propNameTextCSS} from '@theatre/studio/propEditors/utils/propNameTextCSS'
import {pointerEventsAutoInNormalMode} from '@theatre/studio/css'
import DeterminePropEditorForDetail from '@theatre/studio/panels/DetailPanel/DeterminePropEditorForDetail'
import type SheetObject from '@theatre/core/sheetObjects/SheetObject'
import {useEditingToolsForCompoundProp} from '@theatre/studio/propEditors/useEditingToolsForCompoundProp'
import type {PropHighlighted} from '@theatre/studio/panels/SequenceEditorPanel/whatPropIsHighlighted'
import {whatPropIsHighlighted} from '@theatre/studio/panels/SequenceEditorPanel/whatPropIsHighlighted'
import {deriver} from '@theatre/studio/utils/derive-utils'
import NumberPropEditor from '@theatre/studio/propEditors/simpleEditors/NumberPropEditor'
import type {IDetailSimplePropEditorProps} from './DetailSimplePropEditor'
import {useEditingToolsForSimplePropInDetailsPanel} from '@theatre/studio/propEditors/useEditingToolsForSimpleProp'
import {usePrism} from '@theatre/react'
import {val} from '@theatre/dataverse'
import {HiOutlineChevronRight} from 'react-icons/hi'
import memoizeFn from '@theatre/utils/memoizeFn'
import {collapsedMap} from './collapsedMap'
import useChordial from '@theatre/studio/uiComponents/chordial/useChodrial'
import {__private} from '@theatre/core'

const {isPropConfigComposite} = __private.propTypeUtils

const Container = styled.div`
  --step: 15px;
  --left-pad: 10px;
  ${pointerEventsAutoInNormalMode};
  --right-width: 60%;
`

const Header = styled.div<{isHighlighted: PropHighlighted}>`
  height: 30px;
  display: flex;
  align-items: stretch;
  position: relative;
`

const Padding = styled.div<{isVectorProp: boolean}>`
  padding-left: ${rowIndentationFormulaCSS};
  display: flex;
  align-items: center;
  overflow: hidden;
  ${({isVectorProp}) =>
    isVectorProp ? 'width: calc(100% - var(--right-width))' : ''};
`

const ControlIndicators = styled.div`
  flexshrink: 0;
`

const PropName = deriver(styled.div<{isHighlighted: PropHighlighted}>`
  margin-left: 4px;
  cursor: default;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
  &:hover {
    color: white;
  }
  overflow: hidden;

  ${() => propNameTextCSS};
`)

const CollapseIcon = styled.span<{isCollapsed: boolean; isVector: boolean}>`
  width: 28px;
  height: 28px;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;

  transition:
    transform 0.05s ease-out,
    color 0.1s ease-out;
  transform: rotateZ(${(props) => (props.isCollapsed ? 0 : 90)}deg);
  color: #66686a;

  visibility: ${(props) =>
    // If it's a vector, show the collapse icon only when it's expanded
    (!props.isVector && props.isCollapsed) ||
    // If it's a regular compond prop, show the collapse icon only when it's collapsed
    (props.isVector && !props.isCollapsed)
      ? 'visible'
      : 'hidden'};

  ${Header}:hover & {
    visibility: visible;
  }

  &:hover {
    transform: rotateZ(${(props) => (props.isCollapsed ? 15 : 75)}deg);
    color: #c0c4c9;
  }
`

const color = transparentize(0.05, `#282b2f`)

const SubProps = styled.div<{depth: number; lastSubIsComposite: boolean}>`
  /* background: ${({depth}) => darken(depth * 0.03, color)}; */
  /* padding: ${(props) => (props.lastSubIsComposite ? 0 : '4px')} 0; */
`

const isVectorProp = memoizeFn((propConfig: PropTypeConfig_Compound<any>) => {
  const props = Object.entries(propConfig.props)

  return (
    props.length <= 3 &&
    props.every(
      ([name, conf]) =>
        conf.type === 'number' && ['x', 'y', 'z'].includes(name),
    )
  )
})

function VectorComponentEditor<TPropTypeConfig extends PropTypeConfig_Number>({
  propConfig,
  pointerToProp,
  obj,
  SimpleEditorComponent: EditorComponent,
}: IDetailSimplePropEditorProps<TPropTypeConfig>) {
  const editingTools = useEditingToolsForSimplePropInDetailsPanel(
    pointerToProp,
    obj,
    propConfig,
  )

  return (
    <NumberPropEditor
      editingTools={editingTools}
      propConfig={propConfig}
      value={editingTools.value}
    />
  )
}

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: stretch;
  padding: 0 8px 0 2px;
  box-sizing: border-box;
  height: 100%;
  width: var(--right-width);
  flex-shrink: 0;
  flex-grow: 0;
`

export type ICompoundPropDetailEditorProps<
  TPropTypeConfig extends PropTypeConfig_Compound<any>,
> = {
  propConfig: TPropTypeConfig
  pointerToProp: Pointer<TPropTypeConfig['valueType']>
  obj: SheetObject
  visualIndentation: number
}

function DetailCompoundPropEditor<
  TPropTypeConfig extends PropTypeConfig_Compound<any>,
>({
  pointerToProp,
  obj,
  propConfig,
  visualIndentation,
}: ICompoundPropDetailEditorProps<TPropTypeConfig>) {
  const propName =
    propConfig.label ?? (last(getPointerParts(pointerToProp).path) as string)

  const allSubs = Object.entries(propConfig.props)
  const compositeSubs = allSubs.filter(([_, conf]) =>
    isPropConfigComposite(conf),
  )
  const nonCompositeSubs = allSubs.filter(
    ([_, conf]) => !isPropConfigComposite(conf),
  )

  const tools = useEditingToolsForCompoundProp(
    pointerToProp as $FixMe,
    obj,
    propConfig,
  )

  const label: string = propName || 'Props'

  const lastSubPropIsComposite = compositeSubs.length > 0

  const isPropHighlightedD = useMemo(
    () =>
      whatPropIsHighlighted.getIsPropHighlightedD({
        ...obj.address,
        pathToProp: getPointerParts(pointerToProp).path,
      }),
    [pointerToProp],
  )

  // isVectorProp is already memoized, so no need to wrap this in `useMemo()`
  const isVector = isVectorProp(propConfig)

  const isCollapsedAtom = useMemo(() => {
    if (!collapsedMap.has(pointerToProp)) {
      collapsedMap.set(pointerToProp, new Atom(isVector))
    }
    return collapsedMap.get(pointerToProp)!
  }, [pointerToProp])

  const isCollapsed = usePrism(() => {
    return isCollapsedAtom ? val(isCollapsedAtom.pointer) : isVector
  }, [isCollapsedAtom, isVector])

  const {targetRef} = useChordial(() => {
    const title = ['obj', 'props', ...getPointerParts(pointerToProp).path].join(
      '.',
    )
    return {title, items: tools.contextMenuItems}
  })

  return (
    <Container>
      <Header
        // @ts-ignore
        style={{'--depth': visualIndentation - 1}}
      >
        <Padding isVectorProp={isVector}>
          <ControlIndicators>{tools.controlIndicators}</ControlIndicators>

          <PropName isHighlighted={isPropHighlightedD} ref={targetRef}>
            <span>{label}</span>
          </PropName>
          <CollapseIcon
            isCollapsed={isCollapsed}
            isVector={isVector}
            onClick={() => {
              isCollapsedAtom.set(!isCollapsedAtom.get())
            }}
          >
            <HiOutlineChevronRight />
          </CollapseIcon>
        </Padding>
        {isVector && isCollapsed && (
          <InputContainer>
            {[...allSubs].map(([subPropKey, subPropConfig]) => {
              return (
                <VectorComponentEditor
                  key={'prop-' + subPropKey}
                  // @ts-ignore
                  propConfig={subPropConfig}
                  pointerToProp={pointerToProp[subPropKey] as Pointer<$FixMe>}
                  obj={obj}
                />
              )
            })}
          </InputContainer>
        )}
      </Header>

      {!isCollapsed && (
        <SubProps
          // @ts-ignore
          style={{'--depth': visualIndentation}}
          depth={visualIndentation}
          lastSubIsComposite={lastSubPropIsComposite}
        >
          {[...nonCompositeSubs, ...compositeSubs].map(
            ([subPropKey, subPropConfig]) => {
              return (
                <DeterminePropEditorForDetail
                  key={'prop-' + subPropKey}
                  propConfig={subPropConfig}
                  pointerToProp={pointerToProp[subPropKey] as Pointer<$FixMe>}
                  obj={obj}
                  visualIndentation={visualIndentation + 1}
                />
              )
            },
          )}
        </SubProps>
      )}
    </Container>
  )
}

export default React.memo(DetailCompoundPropEditor)
