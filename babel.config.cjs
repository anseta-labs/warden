/** Used by Jest so ESM .js in @chainsafe/* can be executed in Node. */
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
