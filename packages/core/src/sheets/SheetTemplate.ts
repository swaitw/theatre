import type Project from '@theatre/core/projects/Project'
import SheetObjectTemplate from '@theatre/core/sheetObjects/SheetObjectTemplate'
import type {
  SheetAddress,
  WithoutSheetInstance,
} from '@theatre/core/types/public'
import {Atom} from '@theatre/dataverse'
import type {Pointer} from '@theatre/dataverse'
import Sheet from './Sheet'
import type {ObjectNativeObject} from './Sheet'

import type {
  ObjectAddressKey,
  SheetId,
  SheetInstanceId,
} from '@theatre/core/types/public'
import type {StrictRecord} from '@theatre/core/types/public'
import type {
  SheetObjectActionsConfig,
  SheetObjectPropTypeConfig,
} from '@theatre/core/types/public'

type SheetTemplateObjectTemplateMap = StrictRecord<
  ObjectAddressKey,
  SheetObjectTemplate
>

export default class SheetTemplate {
  readonly type: 'Theatre_SheetTemplate' = 'Theatre_SheetTemplate'
  readonly address: WithoutSheetInstance<SheetAddress>
  private _instances = new Atom<Record<SheetInstanceId, Sheet>>({})
  readonly instancesP: Pointer<Record<SheetInstanceId, Sheet>> =
    this._instances.pointer

  private _objectTemplates = new Atom<SheetTemplateObjectTemplateMap>({})
  readonly objectTemplatesP = this._objectTemplates.pointer

  constructor(
    readonly project: Project,
    sheetId: SheetId,
  ) {
    this.address = {...project.address, sheetId}
  }

  getInstance(instanceId: SheetInstanceId): Sheet {
    let inst = this._instances.get()[instanceId]

    if (!inst) {
      inst = new Sheet(this, instanceId)
      this._instances.setByPointer((p) => p[instanceId], inst)
    }

    return inst
  }

  getObjectTemplate(
    objectKey: ObjectAddressKey,
    nativeObject: ObjectNativeObject,
    config: SheetObjectPropTypeConfig,
    actions: SheetObjectActionsConfig,
  ): SheetObjectTemplate {
    let template = this._objectTemplates.get()[objectKey]

    if (!template) {
      template = new SheetObjectTemplate(
        this,
        objectKey,
        nativeObject,
        config,
        actions,
      )
      this._objectTemplates.setByPointer((p) => p[objectKey], template)
    }

    return template
  }
}
