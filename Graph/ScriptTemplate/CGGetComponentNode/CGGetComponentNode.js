const Amaz = effect.Amaz;
const {BaseNode} = require('./BaseNode');

class CGGetComponentNode extends BaseNode {
  constructor() {
    super();
  }

  getOutput(index) {
    return this.inputs[0]();
  }
}

exports.CGGetComponentNode = CGGetComponentNode;
