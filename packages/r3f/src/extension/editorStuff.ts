import type {ISheet, ISheetObject} from '@theatre/core'
import {types, getStudioSync} from '@theatre/core'

let sheet: ISheet | undefined = undefined
let sheetObject: ISheetObject<typeof editorSheetObjectConfig> | undefined =
  undefined

const editorSheetObjectConfig = {
  viewport: types.compound(
    {
      showAxes: types.boolean(true, {label: 'Axes'}),
      showGrid: types.boolean(true, {label: 'Grid'}),
      showOverlayIcons: types.boolean(false, {label: 'Overlay Icons'}),
      shading: types.stringLiteral(
        'rendered',
        {
          flat: 'Flat',
          rendered: 'Rendered',
          solid: 'Solid',
          wireframe: 'Wireframe',
        },
        {as: 'menu', label: 'Shading'},
      ),
      referenceWindow: types.stringLiteral(
        'minimized',
        {
          maximized: 'Maximized',
          minimized: 'Minimized',
          hidden: 'Hidden',
        },
        {as: 'menu', label: 'Reference Window'},
      ),
    },
    {label: 'Viewport Config'},
  ),
  transformControls: types.compound(
    {
      mode: types.stringLiteral(
        'translate',
        {
          translate: 'Translate',
          rotate: 'Rotate',
          scale: 'Scale',
        },
        {as: 'switch', label: 'Mode'},
      ),
      space: types.stringLiteral(
        'world',
        {
          local: 'Local',
          world: 'World',
        },
        {as: 'switch', label: 'Space'},
      ),
    },
    {label: 'Transform Controls'},
  ),
}

export function getEditorSheet(): ISheet {
  if (!sheet) {
    sheet = getStudioSync(true)!.getStudioProject().sheet('R3F UI')
  }
  return sheet
}

export function getEditorSheetObject(): ISheetObject<
  typeof editorSheetObjectConfig
> | null {
  if (!sheetObject) {
    sheetObject =
      getEditorSheet().object('Editor', editorSheetObjectConfig) || null
  }
  return sheetObject
}
