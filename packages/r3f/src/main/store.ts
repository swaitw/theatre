import type {StateCreator} from 'zustand'
import create from 'zustand/vanilla'
import type {Object3D, Scene, WebGLRenderer} from 'three'
import {Group} from 'three'
import type {ISheetObject} from '@theatre/core'
import type {ObjectConfig} from './editableFactoryConfigUtils'

export type TransformControlsMode = 'translate' | 'rotate' | 'scale'
export type TransformControlsSpace = 'world' | 'local'
export type ViewportShading = 'wireframe' | 'flat' | 'solid' | 'rendered'

export type BaseSheetObjectType = ISheetObject<any>

export const allRegisteredObjects = new WeakSet<BaseSheetObjectType>()

export interface Editable<T> {
  type: string
  sheetObject: ISheetObject<any>
  objectConfig: ObjectConfig<T>
  visibleOnlyInEditor: boolean
}

export type EditableSnapshot<T extends Editable<any> = Editable<any>> = {
  proxyObject?: Object3D | null
} & T

export interface SerializedEditable {
  type: string
}

export interface EditableState {
  editables: Record<string, SerializedEditable>
}

export type EditorStore = {
  scene: Scene | null
  gl: WebGLRenderer | null
  helpersRoot: Group
  editables: Record<string, Editable<any>>
  // this will come in handy when we start supporting multiple canvases
  canvasName: string
  sceneSnapshot: Scene | null
  editablesSnapshot: Record<string, EditableSnapshot> | null

  init: (scene: Scene, gl: WebGLRenderer) => void

  addEditable: (theatreKey: string, editable: Editable<any>) => void
  removeEditable: (theatreKey: string) => void
  createSnapshot: () => void
  setSnapshotProxyObject: (
    proxyObject: Object3D | null,
    theatreKey: string,
  ) => void
}

const config: StateCreator<EditorStore> = (set, get) => {
  return {
    sheet: null,
    editorObject: null,
    scene: null,
    gl: null,
    helpersRoot: new Group(),
    editables: {},
    canvasName: 'default',
    sceneSnapshot: null,
    editablesSnapshot: null,
    initialEditorCamera: {},

    init: (scene, gl) => {
      set({
        scene,
        gl,
      })

      // Create a snapshot, so that if the editor is already open, it gets refreshed
      // when the scene is initialized
      get().createSnapshot()
    },

    addEditable: (theatreKey, editable) => {
      set((state) => ({
        editables: {
          ...state.editables,
          [theatreKey]: editable,
        },
      }))
    },

    removeEditable: (theatreKey) => {
      set((state) => {
        const editables = {...state.editables}
        delete editables[theatreKey]
        return {
          editables,
        }
      })
    },

    createSnapshot: () => {
      set((state) => ({
        sceneSnapshot: state.scene?.clone() ?? null,
        editablesSnapshot: state.editables,
      }))
    },

    setSnapshotProxyObject: (proxyObject, theatreKey) => {
      set((state) => ({
        editablesSnapshot: {
          ...state.editablesSnapshot,
          [theatreKey]: {
            ...state.editablesSnapshot![theatreKey],
            proxyObject,
          },
        },
      }))
    },
  }
}

export const editorStore = create<EditorStore>(config)

export type BindFunction = (options: {
  allowImplicitInstancing?: boolean
  gl: WebGLRenderer
  scene: Scene
}) => void

export const bindToCanvas: BindFunction = ({gl, scene}) => {
  const init = editorStore.getState().init
  init(scene, gl)
}
