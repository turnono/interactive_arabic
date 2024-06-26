const Amaz = effect.Amaz;
const {BaseNode} = require('./BaseNode');

class CGGetAssetNode extends BaseNode {
  constructor(resType) {
    super();
  }

  getOutput(index) {
    return this.inputs[0]();
  }
}

exports.CGGetAssetNode = CGGetAssetNode;
