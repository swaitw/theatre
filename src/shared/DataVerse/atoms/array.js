import {default as AbstractCompositeAtom} from './utils/AbstractCompositeAtom' // eslint-disable-line flowtype/require-valid-file-annotation
import {forEach} from 'lodash'
import type {IAtom} from './utils/AbstractAtom'
import Tappable from '$shared/DataVerse/utils/Tappable'
import Emitter from '$shared/DataVerse/utils/Emitter'
import type {AddressedChangeset, MapKey, True, False} from '$shared/DataVerse/types'
import deriveFromArrayAtom from '$shared/DataVerse/derivations/arrays/deriveFromArrayAtom'
import range from 'lodash/range'
import {default as pointer} from '$shared/DataVerse/derivations/pointer'


type Unboxed<O> = $FixMe // eslint-disable-line no-unused-vars

export type ArrayAtomChangeType<V: IAtom> = {
  startIndex: number,
  deleteCount: number,
  addedRefs: Array<V>,
}

export type ArrayAtomDeepChangeType<V> = AddressedChangeset & {type: 'ArrayChange'} &  ArrayAtomChangeType<V>
export type ArrayAtomDeepDiffType<V> = AddressedChangeset & {type: 'ArrayDiff', startIndex: number, deepUnboxOfDeletedRows: Array<Unboxed<V>>, deepUnboxOfAddedRows: Array<Unboxed<V>>}

const changeDescriptor = <V: IAtom>(startIndex: number, deleteCount: number, refsToAdd: Array<V>): ArrayAtomChangeType<V> => ({
  startIndex,
  deleteCount: deleteCount,
  addedRefs: refsToAdd,
})

const deepChangeDescriptor = <V: IAtom>(startIndex: number, deleteCount: number, refsToAdd: Array<V>): ArrayAtomDeepChangeType<V> => ({
  address: [],
  type: 'ArrayChange',
  startIndex,
  deleteCount: deleteCount,
  addedRefs: refsToAdd,
})

const deepDiffDescriptor = (startIndex: number, deletedRefsDeeplyUnboxed: Array<$FixMe>, addedRefsDeeplyUnboxed: Array<$FixMe>) => ({
  address: [],
  type: 'ArrayDiff',
  startIndex,
  deepUnboxOfDeletedRows: deletedRefsDeeplyUnboxed,
  deepUnboxOfAddedRows: addedRefsDeeplyUnboxed,
})

export type IArrayAtom<V: IAtom> = {
  isDictAtom: False,
  isBoxAtom: False,
  isArrayAtom: True,
  _pointer: ?$FixMe,
  _v: V,
  setIndex(key: number, v: V): $FixMe,
  index(index: number): V,
  push(rows: Array<V>): void,
  splice(startIndex: number, deleteCount: number, toAdd: Array<V>): void,
  pop(): ?V,
  shift(): ?V,
  head(): ?V,
  last(): ?V,
  unshift(row: V): void,

  chnages: () => Tappable<ArrayAtomChangeType<V>>,
  deepChanges: () => Tappable<$FixMe>,
  deepDiffs: () => Tappable<$FixMe>,

  _setParent(p: $FixMe, key: MapKey): void,
  _unsetParent(): void,
  getParent(): ?$FixMe,
}

export class ArrayAtom<V: IAtom> extends AbstractCompositeAtom {
  isArrayAtom = 'True'
  _v: V
  _pointer: ?$FixMe
  _internalArray: Array<$FixMe>
  chnages: () => Tappable<ArrayAtomChangeType<V>>
  _changeEmitter: Emitter<ArrayAtomChangeType<V>>
  _refToIndex: *

  constructor(a: Array<V>): _IArrayAtom<V> {
    super()
    this._internalArray = []
    this._refToIndex = new Map()
    this._pointer = undefined

    forEach(a, (value: V) => {
      this._pushWithoutInvokingEvents(value)
    })
    return this
  }

  _pushWithoutInvokingEvents(value: V) {
    this._internalArray.push(value)
    this._refToIndex.set(value, this._internalArray.length - 1)
    this._adopt(this._internalArray.length - 1, value)
  }

  unboxDeep(): $FixMe {
    return this._internalArray.map((value) => {
      if (value !== undefined) {
        return value.unboxDeep()
      }
    })
  }

  length() {
    return this._internalArray.length
  }

  _keyOf(key: MapKey, ref: mixed) {
    return this._refToIndex.get(ref)
  }

  splice(startIndex: number, deleteCount: number, refsToAdd: Array<V>) {
    const removedRefs = range(startIndex, startIndex + deleteCount).map((i) => this.index(i))

    removedRefs.forEach((r, i) => {
      if (r) {
        this._unadopt(i + startIndex, r)
        this._refToIndex.delete(r)
      }
    })

    this._internalArray.splice(startIndex, deleteCount, ...refsToAdd)
    refsToAdd.forEach((ref, i) => {
      const index = i + startIndex
      this._refToIndex.set(ref, index)
      this._adopt(index, ref)
    })

    if (deleteCount !== refsToAdd.length) {
      for (let i = startIndex + refsToAdd.length; i < this._internalArray.length; i++) {
        this._refToIndex.set(this._internalArray[i], i)
      }
    }

    if (this._deepDiffEmitter.hasTappers()) {
      const deletedRefsDeeplyUnboxed = removedRefs.map((r) => r ? r.unboxDeep() : undefined)
      const addedRefsDeeplyUnboxed = refsToAdd.map((r) => r.unboxDeep())
      this._deepDiffEmitter.emit(deepDiffDescriptor(startIndex, deletedRefsDeeplyUnboxed, addedRefsDeeplyUnboxed))
    }

    if (this._deepChangeEmitter.hasTappers()) {
      this._deepChangeEmitter.emit(deepChangeDescriptor(startIndex, deleteCount, refsToAdd))
    }

    if (this._changeEmitter.hasTappers()) {
      this._changeEmitter.emit(changeDescriptor(startIndex, deleteCount, refsToAdd))
    }
  }

  setIndex(index: number, value: V) {
    return this.splice(index, 1, [value])
  }

  push(rows: Array<V>) {
    return this.splice(this.length(), 0, rows)
  }

  pop() {
    const last = this.last()
    this.splice(this.length() - 1, 1, [])
    return last
  }

  head() {
    return this._internalArray[0]
  }

  last() {
    return this._internalArray[this._internalArray.length - 1]
  }

  shift() {
    const head = this.head()
    this.splice(0, 1, [])
    return head
  }

  unshift(row: V) {
    this.splice(0, 0, [row])
  }

  index(index: number): V {
    return this._internalArray[index]
  }

  derivedArray() {
    return deriveFromArrayAtom(this)
  }

  pointer() {
    if (!this._pointer) {
      this._pointer = (pointer({root: this, path: []}): $IntentionalAny)
    }
    return this._pointer
  }
}

export default function array<V: IAtom>(a: Array<V>): IArrayAtom<V> {
  return (new ArrayAtom(a): $IntentionalAny)
}