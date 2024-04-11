import {useEffect, useRef} from 'react'
import type React from 'react'
import type {ChordialOptsFn, ChodrialElement} from './chordialInternals'
import {createChordialElement, findChodrialByDomNode} from './chordialInternals'
import {hoverActor} from './hoverActor'
import {contextActor} from './contextActor'
import {gestureActor} from './gestureActor'
import {mousedownActor} from './mousedownActor'

export default function useChordial(
  optsFn: ChordialOptsFn,
): ChodrialElement['returnValue'] {
  const refs = useRef<ChodrialElement | undefined>()

  if (!refs.current) {
    refs.current = createChordialElement(optsFn)
  }

  refs.current.atom.setByPointer((p) => p.optsFn, optsFn)

  return refs.current.returnValue
}

export const useChordialCaptureEvents =
  (): React.MutableRefObject<HTMLElement | null> => {
    const ref = useRef<HTMLElement | null>(null)

    useEffect(() => {
      const root = ref.current!
      if (!root) return

      window.addEventListener('mousemove', eventHandlers.windowMouseMove)
      root.addEventListener('contextmenu', eventHandlers.contextMenu)
      root.addEventListener('mousemove', eventHandlers.mouseMove)
      root.addEventListener('mousedown', eventHandlers.mouseDown)
      root.addEventListener('mouseup', eventHandlers.mouseUp)
      root.addEventListener('click', eventHandlers.click)

      return () => {
        root.removeEventListener('mousemove', eventHandlers.windowMouseMove)
        root.removeEventListener('contextmenu', eventHandlers.contextMenu)
        root.removeEventListener('mousemove', eventHandlers.mouseMove)
        root.removeEventListener('mousedown', eventHandlers.mouseDown)
        root.removeEventListener('mouseup', eventHandlers.mouseUp)
        root.removeEventListener('click', eventHandlers.click)
      }
    }, [])
    return ref
  }

const eventHandlers = {
  windowMouseMove: (mouseEvent: MouseEvent) => {
    gestureActor.send({type: 'mousemove', mouseEvent})
    hoverActor.send({type: 'mousemove', mouseEvent, source: 'window'})
  },
  mouseMove: (mouseEvent: MouseEvent) => {
    hoverActor.send({type: 'mousemove', mouseEvent, source: 'root'})
  },
  mouseDown: (e: MouseEvent) => {
    mousedownActor.send([true])
    gestureActor.send({type: 'mousedown', mouseEvent: e})
    const el = findChodrialByDomNode(e.target)
    if (!el) return
  },
  mouseUp: (e: MouseEvent) => {
    mousedownActor.send([false])
    gestureActor.send({type: 'mouseup', mouseEvent: e})
    const el = findChodrialByDomNode(e.target)
    if (!el) return
  },
  click: (e: MouseEvent) => {
    gestureActor.send({type: 'click', mouseEvent: e})
    const el = findChodrialByDomNode(e.target)
    if (!el) return
  },
  contextMenu: (e: MouseEvent) => {
    contextActor.send({type: 'rclick', mouseEvent: e})
  },
}
