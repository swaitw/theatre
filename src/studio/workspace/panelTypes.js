// @flow
const panelTypes = {
  elementTree: {
    label: 'Elements Tree',
    components: require('$studio/elementTree'),
  },
  elementInspector: {
    label: 'Element Inspector',
    components: require('$studio/elementInspector'),
  },
  animationTimeline: {
    label: 'Animation Timeline',
    components: require('$studio/animationTimeline'),
  },
  x2: {
    label: 'Modifiers',
    components: require('$studio/x2'),
  },
}

export default panelTypes
