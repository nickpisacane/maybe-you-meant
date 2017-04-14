import React from 'react'
import levenshtein from 'fast-levenshtein'
import arrify from 'arrify'
import some from 'lodash.some'

const getDisplayName = c => c.displayName || c.name || 'Component'
const noop = () => {}
const toRegExp = s => typeof s === 'string' ? new RegExp(`^${s}$`) : s
const normalizeOpts = ({
  include = /./,
  exclude = /[^a-zA-Z0-9]/,
  maxDistance = 3
} = {}) => ({
  include: arrify(include).map(toRegExp),
  exclude: arrify(exclude).map(toRegExp),
  maxDistance
})

function shouldPatch (displayName, { include, exclude }) {
  const isIncluded = some(include, r => r.test(displayName))
  const isExcluded = some(exclude, r => r.test(displayName))
  return isIncluded && !isExcluded
}

function checkProps (Component, props, maxDistance) {
  const displayName = getDisplayName(Component)
  const propTypeKeys = Object.keys(Component.propTypes || {})
  const propKeys = Object.keys(props)

  propKeys.forEach(prop => {
    if (!~propTypeKeys.indexOf(prop)) {
      propTypeKeys.forEach(propType => {
        const dist = levenshtein.get(prop, propType)
        if (dist <= maxDistance) {
          console.warn(
            `${displayName}: got prop "${prop}".` +
            ` Maybe you meant "${propType}"?`
          )
        }
      })
    }
  })
}

function patch (Component, opts) {
  const { maxDistance } = opts
  const displayName = getDisplayName(Component)
  if (Component.__isMaybeYouMeantPatched || !shouldPatch(displayName, opts)) {
    return Component
  }

  Component.__isMaybeYouMeantPatched = true

  if (typeof Component.prototype.render !== 'function') {
    const Wrapper = function (props) {
      checkProps(Component, props, maxDistance)
      return <Component {...props} />
    }
    Wrapper.displayName = `MaybeYouMeant(${displayName})`
    return Wrapper
  }

  const _componentDidMount = Component.prototype.componentDidMount || noop
  const _componentDidUpdate = Component.prototype.componentDidUpdate || noop

  Component.prototype.componentDidMount = function (...args) {
    checkProps(Component, this.props, maxDistance)
    return _componentDidMount.call(this, ...args)
  }

  Component.prototype.componentDidUpdate = function (...args) {
    checkProps(Component, this.props, maxDistance)
    return _componentDidUpdate.call(this, ...args)
  }

  return Component
}

export default function maybeYouMeant (opts = {}) {
  const _createElement = React.createElement
  opts = normalizeOpts(opts)

  React.createElement = function (Component, ...rest) {
    if (typeof Component === 'function') {
      Component = patch(Component, opts)
    }
    return _createElement.call(React, Component, ...rest)
  }

  React.__restoreMaybeYouMeant = () => {
    React.createElement = _createElement
  }
}
