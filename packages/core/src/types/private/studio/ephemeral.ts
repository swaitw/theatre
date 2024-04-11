import type {
  ObjectAddressKey,
  ProjectId,
  SerializableMap,
  SheetId,
} from '@theatre/core/types/public'
import type {StrictRecord} from '@theatre/core/types/public'

/**
 * Technically, all parts of the ephemeral state can be implemented
 * outside the store, using simple Box|Atom of dataverse.
 *
 * The only reason that _some_ of these cases reside in StudioEphemeralState,
 * is to bring them into attention, because these pieces of the state are useful
 * in several (3+) places in the application.
 *
 * Note: Should we just implement all of ephemeral state as boxes and atoms,
 * and remove ephemeral state from the store?
 * - We'd still have to namespace and organize these pieces of ephemeral state,
 *   so they're discoverable.
 *
 *  Disadvantage of that:
 *  - We may want to send over the wire pieces the ephemeral state that other users
 *    have interest in. For example, if Alice is dragging Planet.position, Bob would
 *    want to observe the drag, and not just its final state, which would be in the historic
 *    state. (still, ephemeral state would never be persisted, but parts of it could be sent
 *   over the wire).
 */
export type StudioEphemeralState = {
  projects: {
    stateByProjectId: StrictRecord<
      ProjectId,
      {
        stateBySheetId: StrictRecord<
          SheetId,
          {
            stateByObjectKey: StrictRecord<
              ObjectAddressKey,
              {
                /** e.g. `{color: {r: true, g: true}, price: true}` */
                valuesBeingScrubbed?: SerializableMap<boolean>
              }
            >
          }
        >
      }
    >
  }
}
