import type {$FixMe} from '@theatre/core/types/public'
import type {PanelPosition, UIPanelId} from '@theatre/core/types/private'
import type {PaneInstance} from '@theatre/core/types/public'
import React, {useCallback, useLayoutEffect, useState} from 'react'
import styled from 'styled-components'
import {F2 as F2Impl, TitleBar} from './common'
import BasePanel from './BasePanel'
import PanelDragZone from './PanelDragZone'
import PanelWrapper from './PanelWrapper'
import {ErrorBoundary} from 'react-error-boundary'
import {IoClose} from 'react-icons/io5'
import getStudio from '@theatre/studio/getStudio'
import {panelZIndexes} from '@theatre/studio/panels/BasePanel/common'
import type {PaneInstanceId} from '@theatre/core/types/public'

const defaultPosition: PanelPosition = {
  edges: {
    left: {from: 'screenLeft', distance: 0.3},
    right: {from: 'screenRight', distance: 0.3},
    top: {from: 'screenTop', distance: 0.3},
    bottom: {from: 'screenBottom', distance: 0.3},
  },
}

const minDims = {width: 300, height: 300}

const ExtensionPaneWrapper: React.FC<{
  paneInstance: PaneInstance<$FixMe>
}> = ({paneInstance}) => {
  return (
    <BasePanel
      panelId={`pane-${paneInstance.instanceId}` as UIPanelId}
      defaultPosition={defaultPosition}
      minDims={minDims}
    >
      <Content paneInstance={paneInstance} />
    </BasePanel>
  )
}

const Container = styled(PanelWrapper)`
  display: flex;
  flex-direction: column;

  box-shadow: 0px 5px 12px -4px rgb(0 0 0 / 22%);
  z-index: ${panelZIndexes.pluginPanes};
`

const Title = styled.div`
  width: 100%;
`

const PaneTools = styled.div`
  display: flex;
  align-items: center;
  opacity: 1;
  position: absolute;
  right: 4px;
  top: 0;
  bottom: 0;
`

const ClosePanelButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  font-size: 11px;
  height: 10px;
  width: 18px;
  color: #adadadb3;
  background: transparent;
  border: none;
  cursor: pointer;
  &:hover {
    color: white;
  }
`

/**
 * The &:after part blocks pointer events from reaching the content of the
 * pane when a drag gesture is active in theatre's UI. It's a hack and its downside
 * is that pane content cannot interact with the rest of theatre's UI while a drag
 * gesture is active.
 * TODO find a less hacky way?
 */
const F2 = styled(F2Impl)`
  position: relative;
  overflow: hidden;

  &:after {
    z-index: 10;
    position: absolute;
    inset: 0;
    display: block;
    content: ' ';
    pointer-events: none;

    #pointer-root:not(.normal) & {
      pointer-events: auto;
    }
  }
`

const ErrorContainer = styled.div`
  padding: 12px;

  & > pre {
    border: 1px solid #ff62624f;
    background-color: rgb(255 0 0 / 5%);
    margin: 8px 0;
    padding: 8px;
    font-family: monospace;
    overflow: scroll;
    color: #ff9896;
  }
`

const ErrorFallback: React.FC<{error: Error}> = (props) => {
  return (
    <ErrorContainer>
      An Error occurred rendering this pane. Open the console for more info.
      <pre>
        {JSON.stringify(
          {message: props.error.message, stack: props.error.stack},
          null,
          2,
        )}
      </pre>
    </ErrorContainer>
  )
}

const Content: React.FC<{paneInstance: PaneInstance<$FixMe>}> = ({
  paneInstance,
}) => {
  const [mountingPoint, setMountingPoint] = useState<HTMLElement | null>(null)

  const mount = paneInstance.definition.mount

  useLayoutEffect(() => {
    if (!mountingPoint) return
    const unmount = mount({
      paneId: paneInstance.instanceId,
      node: mountingPoint!,
    })
    if (typeof unmount === 'function') {
      return unmount
    }
  }, [mountingPoint, mount, paneInstance.instanceId])

  const closePane = useCallback(() => {
    getStudio().paneManager.destroyPane(
      paneInstance.instanceId as PaneInstanceId,
    )
  }, [paneInstance])

  return (
    <Container data-testid={`theatre-pane-wrapper-${paneInstance.instanceId}`}>
      <PanelDragZone>
        <TitleBar>
          <PaneTools>
            <ClosePanelButton onClick={closePane} title={'Close Pane'}>
              <IoClose />
            </ClosePanelButton>
          </PaneTools>
          <Title>{paneInstance.instanceId}</Title>
        </TitleBar>
      </PanelDragZone>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <F2
          data-testid={`theatre-pane-content-${paneInstance.instanceId}`}
          ref={setMountingPoint}
        />
      </ErrorBoundary>
    </Container>
  )
}

export default ExtensionPaneWrapper
