import React, { Component } from 'react'
import sinon from 'sinon'
import { mount } from 'enzyme'
import { render } from 'react-dom'
import { expect } from 'chai'
import PropTypes from 'prop-types'

import maybeYouMeant, { whitelisted } from '../../src'

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
    maybeYouMeant({
      warnOnUndeclaredProps: false
    })
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
      /HasNoMethods: received prop "foobbar". Maybe you meant "foobar"\?/,
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
      /HasMethods: received prop "foobbar". Maybe you meant "foobar"\?/,
      0
    )
    expectConsole(
      /HasMethods: received prop "foobbar". Maybe you meant "foobar"\?/,
      1
    )
    expectConsole(
      /HasMethods: received prop "bangg". Maybe you meant "bang"\?/,
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
      warnOnUndeclaredProps: false,
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
        `${Inc.displayName}: received prop "foobbar". Maybe you meant "foobar"\?`
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
    maybeYouMeant({ warnOnUndeclaredProps: false })
  })

  describe('Warn on undeclared props', () => {
    const expectPropWarning = (displayName, propName, index) => {
      const re = new RegExp(
        `${displayName}: received prop "${propName}", but "${propName}" is not declared in propTypes. ` +
        `Maybe you should add "${propName}" to the propTypes for ${displayName}.`
      )
      return expectConsole(re, index)
    }

    before(() => {
      React.__restoreMaybeYouMeant()
      maybeYouMeant({
        warnOnUndeclaredProps: true
      })
    })

    after(() => {
      React.__restoreMaybeYouMeant()
      maybeYouMeant({
        warnOnUndeclaredProps: false
      })
    })

    beforeEach(() => {
      consoleStore = createConsoleStore('warn')
    })

    it('warns when an undeclared prop is passed', () => {
      class Foo extends Component {
        static propTypes = {}
        render () { return <div>foo</div> }
      }

      m(<Foo bar='bang' />)
      expectPropWarning('Foo', 'bar')
    })

    it('doesn\'t warn for whitelisted props', () => {
      class Foo extends Component {
        static propTypes = {}
        render () { return <div>foo</div> }
      }

      m(<Foo
        onClick={() => {}}
        data-bar='bang'
        htmlFor='someId'
        style={{ color: 'blue' }}
        accentHeight='42'
        aria-expanded='false'
      />)
      expect(consoleStore.entries).to.have.length(0)
    })

    it('doesn\'t warn when `propTypes` is not defined', () => {
      class Foo extends Component {
        render () { return <div>foo</div> }
      }

      m(<Foo bang='bar' />)
      expect(consoleStore.entries).to.have.length(0)
    })

    it('whitelistedProps', () => {
      React.__restoreMaybeYouMeant()
      maybeYouMeant({
        warnOnUndeclaredProps: true,
        whitelistedProps: [
          ...whitelisted.all,
          'foo',
          /^bang-/
        ]
      })

      class Foo extends Component {
        static propTypes = {}
        render () { return <div>foo</div> }
      }

      m(<Foo foo='bar' bar='bang' bang-baz='foo' />)
      expectPropWarning('Foo', 'bar')
      expect(consoleStore.entries).to.have.length(1)

      React.__restoreMaybeYouMeant()
      maybeYouMeant({
        warnOnUndeclaredProps: true
      })
    })

    it('export default set of whitelisted props', () => {
      const props = [
        'react',
        'data',
        'aria',
        'html',
        'svg',
        'events',
        'all'
      ]

      props.forEach(prop => {
        expect(whitelisted).to.have.property(prop)
      })
    })
  })
})
