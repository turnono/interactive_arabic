const Amaz = effect.Amaz;
const {BaseNode} = require('./BaseNode');

class CGGetSceneObjectNode extends BaseNode {
  constructor() {
    super();
  }

  getOutput(index) {
    return this.inputs[0]();
  }
}

exports.CGGetSceneObjectNode = CGGetSceneObjectNode;
