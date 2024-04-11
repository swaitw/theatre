/**
 * A super basic Turtle geometry renderer hooked up to Theatre, so the parameters
 * can be tweaked and animated.
 */
import React, {useMemo, useState} from 'react'
import ReactDom from 'react-dom/client'
import {getProject} from '@theatre/core'
import type {ITurtle} from './turtle'
import TurtleRenderer from './TurtleRenderer'
import {useBoundingClientRect} from './utils'

const project = getProject('Turtle Playground')

const sheet = project.sheet('Turtle', 'The only one')

const TurtleExample: React.FC<{}> = (props) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const programFn = useMemo(() => {
    return ({forward, backward, left, right, repeat}: ITurtle) => {
      const steps = 10
      repeat(steps, () => {
        forward(steps * 2)
        right(360 / steps)
      })
    }
  }, [])

  const bounds = useBoundingClientRect(container)

  return (
    <div
      ref={setContainer}
      style={{
        position: 'fixed',
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
        background: 'black',
      }}
    >
      {bounds && (
        <TurtleRenderer
          sheet={sheet}
          objKey="Renderer"
          width={bounds.width}
          height={bounds.height}
          programFn={programFn}
        />
      )}
    </div>
  )
}

ReactDom.createRoot(document.getElementById('root')!).render(<TurtleExample />)
