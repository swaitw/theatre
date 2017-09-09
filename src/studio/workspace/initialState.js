// @flow
import {type WorkspaceNamespaceState} from './types'

const initialState: WorkspaceNamespaceState = {
  panels: {
    byId: {
      '1': {
        pos: {x: 5, y: 10},
        dim: {x: 30, y: 40},
      },
      '2': {
        pos: {x: 50, y: 30},
        dim: {x: 30, y: 40},
      },
    },
    listOfVisibles: ['1', '2'],
  },
  componentIDToBeRenderedAsCurrentCanvas: undefined,
}

export default initialState