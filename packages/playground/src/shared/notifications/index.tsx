import React from 'react'
import ReactDOM from 'react-dom/client'
import theatre from '@theatre/core'
import {getProject, notify} from '@theatre/core'
import {Scene} from './Scene'

void theatre.init({studio: true})

// trigger warning notification
void getProject('Sample project').sheet('Scene').sequence.play()

// fire an info notification
notify.info(
  'Welcome to the notifications playground!',
  'This is a basic example of a notification! You can see the code for this notification ' +
    '(and all others) at the start of index.tsx. You can also see examples of success and warnign notifications.',
)

void getProject('Sample project').ready.then(() => {
  // fire a success notification on project load
  notify.success(
    'Project loaded!',
    'Now you can start calling `sequence.play()` to trigger animations. ;)',
  )
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Scene
    project={getProject('Sample project', {
      // experiments: {
      //   logging: {
      //     internal: true,
      //     dev: true,
      //     min: TheatreLoggerLevel.TRACE,
      //   },
      // },
    })}
  />,
)
