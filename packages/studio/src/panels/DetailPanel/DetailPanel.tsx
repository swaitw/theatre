import {outlineSelection} from '@theatre/studio/selectors'
import {usePrism, useVal} from '@theatre/react'
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import styled from 'styled-components'
import {
  panelZIndexes,
  TitleBar_Piece,
  TitleBar_Punctuation,
} from '@theatre/studio/panels/BasePanel/common'
import {pointerEventsAutoInNormalMode} from '@theatre/studio/css'
import ObjectDetails from './ObjectDetails'
import ProjectDetails from './ProjectDetails'
import getStudio from '@theatre/studio/getStudio'
import useHotspot from '@theatre/studio/uiComponents/useHotspot'
import {Atom, prism, val} from '@theatre/dataverse'
import EmptyState from './EmptyState'
import useLockSet from '@theatre/studio/uiComponents/useLockSet'
import {usePresenceListenersOnRootElement} from '@theatre/studio/uiComponents/usePresence'
import {__private} from '@theatre/core'
const {isProject, isSheetObject} = __private.instanceTypes

const headerHeight = `32px`

const Container = styled.div<{pin: boolean}>`
  ${pointerEventsAutoInNormalMode};
  background-color: rgba(40, 43, 47, 0.8);
  position: fixed;
  right: 8px;
  top: 50px;
  // Temporary, see comment about CSS grid in SingleRowPropEditor.
  width: 280px;
  height: fit-content;
  z-index: ${panelZIndexes.propsPanel};

  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(14px);
  border-radius: 2px;

  display: ${({pin}) => (pin ? 'block' : 'none')};

  &:hover {
    display: block;
  }

  @supports not (backdrop-filter: blur()) {
    background: rgba(40, 43, 47, 0.95);
  }
`

const Title = styled.div`
  margin: 0 10px;
  color: #919191;
  font-weight: 500;
  font-size: 10px;
  user-select: none;
  ${pointerEventsAutoInNormalMode};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Header = styled.div`
  height: ${headerHeight};
  display: flex;
  align-items: center;
`

const Body = styled.div`
  ${pointerEventsAutoInNormalMode};
  max-height: calc(100vh - 100px);
  overflow-y: scroll;
  &::-webkit-scrollbar {
    display: none;
  }

  scrollbar-width: none;
  padding: 0;
  user-select: none;

  /* Set the font-size for input values in the detail panel */
  font-size: 12px;
`

export const contextMenuShownContext = createContext<
  ReturnType<typeof useLockSet>
>([false, () => () => {}])

const DetailPanel: React.FC<{}> = (props) => {
  const pin = useVal(getStudio().atomP.ahistoric.pinDetails) !== false

  const hotspotActive = useHotspot('right')

  useLayoutEffect(() => {
    isDetailPanelHotspotActiveB.set(hotspotActive)
  }, [hotspotActive])

  // cleanup
  useEffect(() => {
    return () => {
      isDetailPanelHoveredB.set(false)
      isDetailPanelHotspotActiveB.set(false)
    }
  }, [])

  const [isContextMenuShown] = useContext(contextMenuShownContext)

  const showDetailsPanel = pin || hotspotActive || isContextMenuShown

  const [containerElt, setContainerElt] = useState<null | HTMLDivElement>(null)
  usePresenceListenersOnRootElement(containerElt)

  return usePrism(() => {
    const selection = outlineSelection.getValue()

    const obj = selection.find(isSheetObject)

    if (obj) {
      return (
        <Container
          data-testid="DetailPanel-Object"
          pin={showDetailsPanel}
          ref={setContainerElt}
          onMouseEnter={() => {
            isDetailPanelHoveredB.set(true)
          }}
          onMouseLeave={() => {
            isDetailPanelHoveredB.set(false)
          }}
        >
          <Header>
            <Title
              title={`${obj.sheet.address.sheetId}: ${obj.sheet.address.sheetInstanceId} > ${obj.address.objectKey}`}
            >
              <TitleBar_Piece>{obj.sheet.address.sheetId} </TitleBar_Piece>

              <TitleBar_Punctuation>{':'}&nbsp;</TitleBar_Punctuation>
              <TitleBar_Piece>
                {obj.sheet.address.sheetInstanceId}{' '}
              </TitleBar_Piece>

              <TitleBar_Punctuation>&nbsp;&rarr;&nbsp;</TitleBar_Punctuation>
              <TitleBar_Piece>{obj.address.objectKey}</TitleBar_Piece>
            </Title>
          </Header>
          <Body>
            <ObjectDetails objects={[obj]} />
          </Body>
        </Container>
      )
    }
    const project = selection.find(isProject)
    if (project) {
      return (
        <Container pin={showDetailsPanel}>
          <Header>
            <Title title={`${project.address.projectId}`}>
              <TitleBar_Piece>{project.address.projectId} </TitleBar_Piece>
            </Title>
          </Header>
          <Body>
            <ProjectDetails projects={[project]} />
          </Body>
        </Container>
      )
    }

    return (
      <Container
        pin={showDetailsPanel}
        onMouseEnter={() => {
          isDetailPanelHoveredB.set(true)
        }}
        onMouseLeave={() => {
          isDetailPanelHoveredB.set(false)
        }}
      >
        <EmptyState />
      </Container>
    )
  }, [showDetailsPanel])
}

export default () => {
  const lockSet = useLockSet()

  return (
    <contextMenuShownContext.Provider value={lockSet}>
      <DetailPanel />
    </contextMenuShownContext.Provider>
  )
}

const isDetailPanelHotspotActiveB = new Atom<boolean>(false)
const isDetailPanelHoveredB = new Atom<boolean>(false)

export const shouldShowDetailD = prism<boolean>(() => {
  const isHovered = val(isDetailPanelHoveredB.prism)
  const isHotspotActive = val(isDetailPanelHotspotActiveB.prism)

  return isHovered || isHotspotActive
})
