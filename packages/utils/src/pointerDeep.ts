import type {Pointer} from '@theatre/dataverse'
import type {PathToProp} from '@theatre/utils/pathToProp'
import type {$IntentionalAny} from '@theatre/utils/types'

/**
 * Points deep into a pointer, using `toAppend` as the path. This is _NOT_ type-safe, so use with caution.
 */
export default function pointerDeep<T>(
  base: Pointer<T>,
  toAppend: PathToProp,
): Pointer<unknown> {
  let p = base as $IntentionalAny
  for (const k of toAppend) {
    p = p[k]
  }
  return p
}
