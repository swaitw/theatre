/*
 * @jest-environment jsdom
 */
import Atom from './Atom'
import {val} from './val'
import prism from './prism/prism'
import Ticker from './Ticker'

describe(`integration`, () => {
  describe(`identity pointers`, () => {
    it(`should work`, () => {
      const data = {foo: 'hi', bar: 0}
      const a = new Atom(data)
      const dataP = a.pointer
      const bar = dataP.bar
      expect(val(bar)).toEqual(0)

      const d = prism(() => {
        return val(bar)
      })
      expect(d.getValue()).toEqual(0)
      const ticker = new Ticker()
      const changes: number[] = []
      d.onChange(ticker, (c) => {
        changes.push(c)
      })
      a.set({...data, bar: 1})
      ticker.tick()
      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual(1)
      a.set({...data, bar: 1})
      ticker.tick()
      expect(changes).toHaveLength(1)
    })
  })
})
