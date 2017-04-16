import React from 'react'
import levenshtein from 'fast-levenshtein'
import arrify from 'arrify'
import some from 'lodash.some'

import * as reactProps from './reactProps'

const getDisplayName = c => c.displayName || c.name || 'Component'
const noop = () => {}
const toRegExp = s => typeof s === 'string' ? new RegExp(`^${s}$`) : s
const testAgainstRegArr = (s, arr) => some(arr, r => r.test(s))

/**
 * Whitelisted properties from React/DOM/Svg
 * @prop "react" React internal properties
 * @prop "data" Data-attributes (i.e. begins with `data-`)
 * @prop "aria" Aria-attributes (i.e. begins with `aria-`)
 * @prop "events" React event property names
 * @prop "html" Html propety names
 * @prop "svg" SVG propety names
 * @prop "all" All properties above
 */
export const whitelisted = Object.keys(reactProps)
  .reduce((whitelisted, key) => {
    whitelisted[key] = reactProps[key].map(toRegExp)
    return whitelisted
  }, {})

whitelisted.all = Object.keys(whitelisted)
  .reduce((all, key) => {
    return all.concat(whitelisted[key])
  }, [])

const normalizeOpts = ({
  include = /./,
  exclude = /[^a-zA-Z0-9]/,
  maxDistance = 2,
  warnOnUndeclaredProps = true,
  whitelistedProps = whitelisted.all
} = {}) => ({
  include: arrify(include).map(toRegExp),
  exclude: arrify(exclude).map(toRegExp),
  maxDistance,
  warnOnUndeclaredProps,
  whitelistedProps: arrify(whitelistedProps).map(toRegExp)
})

function shouldPatch (displayName, { include, exclude }) {
  const isIncluded = testAgainstRegArr(displayName, include)
  const isExcluded = testAgainstRegArr(displayName, exclude)
  return isIncluded && !isExcluded
}

function checkProps (Component, props, opts) {
  const { maxDistance, warnOnUndeclaredProps, whitelistedProps } = opts
  const displayName = getDisplayName(Component)
  const hasPropTypes = !!Component.propTypes
  const propTypeKeys = Object.keys(Component.propTypes || {})
  const propKeys = Object.keys(props)

  propKeys.forEach(prop => {
    if (!~propTypeKeys.indexOf(prop)) {
      // Warn when prop is within `maxDistance` from a declared prop
      propTypeKeys.forEach(propType => {
        const dist = levenshtein.get(prop, propType)
        if (dist <= maxDistance) {
          console.warn(
            `${displayName}: received prop "${prop}".` +
            ` Maybe you meant "${propType}"?`
          )
        }
      })

      // Warn when a prop is passed, and not declared in `propTypes`
      if (
        warnOnUndeclaredProps && hasPropTypes &&
        !testAgainstRegArr(prop, whitelistedProps)
      ) {
        console.warn(
          `${displayName}: received prop "${prop}",` +
          ` but "${prop}" is not declared in propTypes. Maybe you should add ` +
          `"${prop}" to your propTypes.`
        )
      }
    }
  })
}

function patch (Component, opts) {
  const displayName = getDisplayName(Component)
  if (Component.__isMaybeYouMeantPatched || !shouldPatch(displayName, opts)) {
    return Component
  }

  Component.__isMaybeYouMeantPatched = true

  if (typeof Component.prototype.render !== 'function') {
    const Wrapper = function (props) {
      checkProps(Component, props, opts)
      return <Component {...props} />
    }
    Wrapper.displayName = `MaybeYouMeant(${displayName})`
    return Wrapper
  }

  const _componentDidMount = Component.prototype.componentDidMount || noop
  const _componentDidUpdate = Component.prototype.componentDidUpdate || noop

  Component.prototype.componentDidMount = function (...args) {
    checkProps(Component, this.props, opts)
    return _componentDidMount.call(this, ...args)
  }

  Component.prototype.componentDidUpdate = function (...args) {
    checkProps(Component, this.props, opts)
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
