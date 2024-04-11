import React, {useContext} from 'react'
import {TooltipOverlay} from './TooltipOverlay'
import {ContextOverlay} from './ContextOverlay'
import {createPortal} from 'react-dom'
import {PortalContext} from 'reakit'
import {PopoverOverlay} from './PopoverOverlay'

export const ChordialOverlay = () => {
  const portalLayer = useContext(PortalContext)

  if (!portalLayer) return null

  return createPortal(
    <>
      <TooltipOverlay />
      <ContextOverlay />
      <PopoverOverlay />
    </>,
    portalLayer,
  )
}
