import type {
  StudioAhistoricState,
  StudioEphemeralState,
  StudioHistoricState,
  StudioState,
} from '@theatre/core/types/private'
import type {$FixMe, $IntentionalAny, VoidFn} from '@theatre/core/types/public'
import {Atom} from '@theatre/dataverse'
import type {Pointer} from '@theatre/dataverse'
import type {Draft} from 'immer'
import type {OnDiskState} from '@theatre/core/types/private'
import * as Saaz from '@theatre/saaz'
import type {ProjectId} from '@theatre/core/types/public'
import {schema} from '@theatre/sync-server/state/schema'
import type {
  IInvokableDraftEditors,
  IStateEditors,
  StateEditorsAPI,
} from '@theatre/sync-server/state/schema'
import createTransactionPrivateApi from './createTransactionPrivateApi'
import {SaazBack} from '@theatre/saaz'
import type {Studio} from '@theatre/studio/Studio'
import getStudio from '@theatre/studio/getStudio'

export type Drafts = {
  historic: Draft<StudioHistoricState>
  ahistoric: Draft<StudioAhistoricState>
  ephemeral: Draft<StudioEphemeralState>
}

export interface ITransactionPrivateApi {
  set<T>(pointer: Pointer<T>, value: T): void
  unset<T>(pointer: Pointer<T>): void
  stateEditors: IInvokableDraftEditors
}

export type CommitOrDiscardOrRecapture = {
  commit: (undoable?: boolean) => void
  discard: VoidFn
  recapture: (fn: (api: ITransactionPrivateApi) => void) => void
  reset: VoidFn
}

export default class StudioStore {
  private readonly _atom: Atom<StudioState>
  readonly atomP: Pointer<StudioState>

  private _saaz: Saaz.SaazFront<
    {$schemaVersion: number},
    IStateEditors,
    StateEditorsAPI,
    StudioState
  >

  constructor(readonly studio: Studio) {
    const backend =
      typeof window === 'undefined'
        ? new SaazBack({
            storageAdapter: new Saaz.BackMemoryAdapter(),
            dbName: 'test',
            schema,
          })
        : createTrpcBackend(
            this.studio._optsPromise.then((opts) => opts.persistenceKey),
          )

    const saaz = new Saaz.SaazFront({
      schema,
      dbName: 'test',
      storageAdapter:
        typeof window === 'undefined' || process.env.NODE_ENV === 'test' || true
          ? new Saaz.FrontMemoryAdapter()
          : new Saaz.FrontIDBAdapter('blah', 'test'),
      backend,
    })
    this._saaz = saaz as $IntentionalAny

    this._atom = new Atom({} as StudioState)
    this._atom.set(saaz.state.cell as $FixMe)

    saaz.subscribe((state) => {
      this._atom.set(state.cell as $IntentionalAny)
    })
    this.atomP = this._atom.pointer
  }

  getState(): StudioState {
    return this._atom.get()
    // return this._reduxStore.getState()
  }

  __experimental_clearPersistentStorage(persistenceKey: string): StudioState {
    throw new Error(`Implement me?`)
    // __experimental_clearPersistentStorage(this._reduxStore, persistenceKey)
    return this.getState()
  }

  /**
   * This method causes the store to start the history from scratch. This is useful
   * for testing and development where you want to explicitly provide a state to the
   * store.
   */
  __dev_startHistoryFromScratch(newHistoricPart: StudioHistoricState) {
    throw new Error(`Implement me?`)
    // this._reduxStore.dispatch(
    //   studioActions.historic.startHistoryFromScratch(
    //     studioActions.reduceParts((s) => ({...s, historic: newHistoricPart})),
    //   ),
    // )
  }

  transaction(
    fn: (api: ITransactionPrivateApi) => void,
    undoable: boolean = true,
  ) {
    this._saaz.tx(
      () => {},
      (draft) => {
        let running = true

        let ensureRunning = () => {
          if (!running) {
            throw new Error(
              `You seem to have called the transaction api after studio.transaction() has finished running`,
            )
          }
        }
        const transactionApi = createTransactionPrivateApi(ensureRunning, draft)
        const ret = fn(transactionApi)
        running = false
        return ret
      },
      undoable,
    )
    return
  }

  tempTransaction(
    fn: (api: ITransactionPrivateApi) => void,
    existingTransaction: CommitOrDiscardOrRecapture | undefined = undefined,
  ): CommitOrDiscardOrRecapture {
    if (existingTransaction) {
      existingTransaction.recapture(fn)
      return existingTransaction
    }

    const t = this._saaz.tempTx(
      () => {},
      (draft) => {
        let running = true

        let ensureRunning = () => {
          if (!running) {
            throw new Error(
              `You seem to have called the transaction api after studio.transaction() has finished running`,
            )
          }
        }
        const transactionApi = createTransactionPrivateApi(ensureRunning, draft)
        const ret = fn(transactionApi)
        running = false
        return ret
      },
    )

    return {
      commit: t.commit,
      discard: t.discard,
      reset: t.reset,
      recapture: (fn: (api: ITransactionPrivateApi) => void): void => {
        t.recapture(
          () => {},
          (draft) => {
            let running = true

            let ensureRunning = () => {
              if (!running) {
                throw new Error(
                  `You seem to have called the transaction api after studio.transaction() has finished running`,
                )
              }
            }
            const transactionApi = createTransactionPrivateApi(
              ensureRunning,
              draft,
            )
            const ret = fn(transactionApi)
            running = false
          },
        )
      },
    }
  }

  undo() {
    this._saaz.undo()
  }

  redo() {
    this._saaz.redo()
  }

  createContentOfSaveFile(projectId: ProjectId): OnDiskState {
    throw new Error(`Implement me`)
    // const projectState =
    //   this._reduxStore.getState().$persistent.historic.innerState.coreByProject[
    //     projectId
    //   ]

    // if (!projectState) {
    //   throw new Error(`Project ${projectId} has not been initialized.`)
    // }

    // const revision = generateDiskStateRevision()

    // this.tempTransaction(({stateEditors}) => {
    //   stateEditors.coreByProject.historic.revisionHistory.add({
    //     projectId,
    //     revision,
    //   })
    // }).commit()

    // const projectHistoricState =
    //   this._reduxStore.getState().$persistent.historic.innerState.coreByProject[
    //     projectId
    //   ]

    // const generatedOnDiskState: OnDiskState = {
    //   ...projectHistoricState,
    // }

    // return generatedOnDiskState
  }

  // get appApi(): TrpcClientWrapped<AppLink['api']> {
  //   return this.auth.appApi
  // }

  // get syncServerApi(): TrpcClientWrapped<SyncServerLink['api']> {
  //   return this.auth.syncServerApi
  // }
}

function createTrpcBackend(
  dbNamePromise: Promise<string>,
): Saaz.SaazBackInterface {
  const applyUpdates: Saaz.SaazBackInterface['applyUpdates'] = async (opts) => {
    const syncServerApi = getStudio().authedLinks.syncServer
    const dbName = await dbNamePromise
    return await syncServerApi.projectState.saaz_applyUpdates.mutate({
      dbName,
      opts,
    })
  }

  const updatePresence: Saaz.SaazBackInterface['updatePresence'] = async (
    opts,
  ) => {
    const dbName = await dbNamePromise
    const syncServerApi = getStudio().authedLinks.syncServer

    return await syncServerApi.projectState.saaz_updatePresence.mutate({
      dbName,
      opts,
    })
  }

  const getUpdatesSinceClock: Saaz.SaazBackInterface['getUpdatesSinceClock'] =
    async (opts) => {
      const dbName = await dbNamePromise
      const syncServerApi = getStudio().authedLinks.syncServer

      return await syncServerApi.projectState.saaz_getUpdatesSinceClock.query({
        dbName,
        opts,
      })
    }

  const getLastIncorporatedPeerClock: Saaz.SaazBackInterface['getLastIncorporatedPeerClock'] =
    async (opts) => {
      const dbName = await dbNamePromise
      const syncServerApi = getStudio().authedLinks.syncServer

      return await syncServerApi.projectState.saaz_getLastIncorporatedPeerClock.query(
        {
          dbName,
          opts,
        },
      )
    }

  const closePeer: Saaz.SaazBackInterface['closePeer'] = async (opts) => {
    const dbName = await dbNamePromise
    const syncServerApi = getStudio().authedLinks.syncServer

    return await syncServerApi.projectState.saaz_closePeer.mutate({
      dbName,
      opts,
    })
  }

  const subscribe: Saaz.SaazBackInterface['subscribe'] = async (
    opts,
    onUpdate,
  ) => {
    const dbName = await dbNamePromise
    const syncServerApi = getStudio().authedLinks.syncServer

    const subscription = syncServerApi.projectState.saaz_subscribe.subscribe(
      {
        dbName,
        opts,
      },
      {
        onData(d) {
          onUpdate(d as $FixMe)
        },
      },
    )

    return subscription.unsubscribe
  }
  return {
    applyUpdates,
    getUpdatesSinceClock,
    subscribe,
    updatePresence,
    closePeer,
    getLastIncorporatedPeerClock,
  }
}
