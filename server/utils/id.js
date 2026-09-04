let counter = 0;

module.exports = function genId(prefix) {
  counter = (counter + 1) % 100000;
  return `${prefix}-${Date.now()}-${counter}`;
};
