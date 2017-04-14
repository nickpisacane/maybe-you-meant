import React, { Component } from 'react'
import sinon from 'sinon'
import { mount } from 'enzyme'
import { render } from 'react-dom'
import { expect } from 'chai'
import PropTypes from 'prop-types'

import maybeYouMeant from '../../src'

const createConsoleStore = (type, debug) => {
  const entries = []
  const fn = console[type]
  const consoleStore = {
    entries: [],
    destroy () {
      console[type] = fn
    },
    clear () {
      this.entries = []
    }
  }

  console[type] = (...args) => {
    consoleStore.entries.push(args)
    debug && fn.call(console, ...args)
  }

  return consoleStore
}

describe('maybeYouMeant', function () {
  let consoleStore
  let node
  const m = c => mount(c, { attachTo: node })
  const expectConsole = (re, index = 0) => {
    const entry = consoleStore.entries[index]
    if (!entry || !entry.length) {
      throw new Error(`No console entry at ${index}`)
    }
    expect(re.test(entry[0])).to.equal(true)
  }

  before (() => {
    node = document.createElement('div')
    maybeYouMeant()
  })

  beforeEach(() => {
    consoleStore = createConsoleStore('warn')
  })

  afterEach(() => {
    consoleStore.destroy()
  })

  it('warns when similar prop types are passed', () => {
    class HasNoMethods extends Component {
      static propTypes = {
        foobar: PropTypes.bool
      }
      render () {
        return <div>foobar</div>
      }
    }
    m(<HasNoMethods foobbar />, { attachTo: node })
    expectConsole(
      /HasNoMethods: got prop "foobbar". Maybe you meant "foobar"\?/,
      0
    )
  })

  it('works on components with `componentDidUpdate` and `componentDidMount`', () => {
    const didMount = sinon.spy()
    const didUpdate = sinon.spy()

    class HasMethods extends Component {
      static propTypes = {
        foobar:  PropTypes.bool,
        bang: PropTypes.bool
      }
      componentDidMount () {
        didMount()
      }
      componentDidUpdate () {
        didUpdate()
      }
      render () {
        return <div>foo</div>
      }
    }

    const wrapper = m(<HasMethods foobbar bang />)
    wrapper.setProps({
      foobar: true,
      bangg: true
    })
    expect(didMount.calledOnce).to.equal(true)
    expect(didUpdate.calledOnce).to.equal(true)
    expectConsole(
      /HasMethods: got prop "foobbar". Maybe you meant "foobar"\?/,
      0
    )
    expectConsole(
      /HasMethods: got prop "foobbar". Maybe you meant "foobar"\?/,
      1
    )
    expectConsole(
      /HasMethods: got prop "bangg". Maybe you meant "bang"\?/,
      2
    )
  })

  it('works on functional components', () => {
    function Functional (props) {
      return <div>Functional</div>
    }
    Functional.propTypes = {
      foobar: PropTypes.bool
    }

    m(<Functional foobbar />)
  })

  it('include exclude opts', () => {
    React.__restoreMaybeYouMeant()
    maybeYouMeant({
      include: [/^Include/, 'PatchMe'],
      exclude: [/^Exclude/, 'DoNotPatchMe']
    })

    const createComponent = displayName => class Comp extends Component {
      static displayName = displayName
      static propTypes = {
        foobar: PropTypes.bool
      }
      render () {
        return <div>{displayName}</div>
      }
    }

    const includes = [
      createComponent('IncludeFoo'),
      createComponent('PatchMe')
    ]
    const excludes = [
      createComponent('ExcludeBar'),
      createComponent('DoNotPatchMe')
    ]

    includes.forEach(Inc => {
      m(<Inc foobbar />)
      const re = new RegExp(
        `${Inc.displayName}: got prop "foobbar". Maybe you meant "foobar"\?`
      )
      expectConsole(re)
      consoleStore.clear()
    })

    excludes.forEach(Exc => {
      m(<Exc foobbar />)
      expect(consoleStore.entries).to.have.length(0)
      consoleStore.clear()
    })

    React.__restoreMaybeYouMeant()
    maybeYouMeant()
  })
})
