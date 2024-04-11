import type {Asset} from '@theatre/core/types/public'
import type Project from '@theatre/core/projects/Project'
import {val} from '@theatre/dataverse'
import type {$IntentionalAny} from '@theatre/core/types/public'
import {__private} from '@theatre/core'
const {forEachPropDeep} = __private.propTypeUtils
const {keyframeUtils} = __private

export function getAllPossibleAssetIDs(project: Project, type?: string) {
  const sheets = Object.values(val(project.pointers.historic.sheetsById) ?? {})
  const staticValues = sheets
    .flatMap((sheet) => Object.values(sheet?.staticOverrides.byObject ?? {}))
    .flatMap((overrides) => Object.values(overrides ?? {}))

  const keyframeValues = sheets
    .flatMap((sheet) => Object.values(sheet?.sequence?.tracksByObject ?? {}))
    .flatMap((tracks) => Object.values(tracks?.trackData ?? {}))
    .flatMap((track) =>
      keyframeUtils.getSortedKeyframesCached(
        track?.keyframes ?? {byId: {}, allIds: {}},
      ),
    )
    .map((keyframe) => keyframe?.value)

  const allValues = [...keyframeValues]
  staticValues.forEach((value) => {
    forEachPropDeep(
      value,
      (v) => {
        allValues.push(v as $IntentionalAny)
      },
      [],
    )
  })

  const allAssets = allValues
    // value is Asset of the type provided
    .filter((value) => {
      return (
        (value as Asset | undefined)?.type &&
        (type
          ? (value as Asset | undefined)?.type == type
          : typeof (value as Asset | undefined)?.type === 'string')
      )
    })
    // map assets to their ids
    .map((value) => (value as Asset).id)
    // ensure ids are unique and not null and not empty
    .filter(
      (id, index, self) =>
        id !== null && id !== '' && self.indexOf(id) === index,
    ) as string[]

  return allAssets
}
