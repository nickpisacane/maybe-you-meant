# maybe-you-meant

Find deceptive typo's in your react projects.

Are you familiar with the following?

```js

class Foo extends Component {
  static propTypes = {
    foobar: PropTypes.string
  }

  static defaultProps = {
    foobar: 'whatever'
  }
}

// Somewhere in the app

// Oops! We misspelled, but we won't blow up because of a default prop type.
<Foo foobbar='not whatever' />
```

If so, `maybe-you-meant` can help. Maybe you meant patches `React.createElement`
to patch every single component's `componentDidMount`, `componentDidUpdate`
(or wrap functional components) to issue console warnings whenever a prop type
is similar (but not equal) to your defined `propTypes`

# Installation

```sh
  yarn add -D maybe-you-meant
  # Or
  npm i -D maybe-you-meant
```

# Usage

```js
  // Somewhere in the top of your app
  import maybeYouMeant from 'maybe-you-meant'
  maybeYouMeant()

  // or
  maybeYouMeant({
    maxDistance: 3,
    include: [/^Include/, 'PatchMe'],
    exlclude: [/^Connect/, 'DoNotPatchMe']
  })
```

# API

### maybeYouMeant([opts])
* opts {Object}
* opts.maxDistance {Number} The max distance between given prop and prop-type (from [Levenshtein ](https://en.wikipedia.org/wiki/Levenshtein_distance) algorithm) for warnings
* opts.include {String|RegExp|Array<String|RegExp>} String or RegExp matching for including Components (tested on displayName)
* opts.include {String|RegExp|Array<String|RegExp>} String or RegExp matching for excluding Components (tested on displayName)
