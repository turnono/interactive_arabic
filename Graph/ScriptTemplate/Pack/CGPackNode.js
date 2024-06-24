const {BaseNode} = require('./BaseNode');
const Amaz = effect.Amaz;

class CGPackNode extends BaseNode {
  constructor() {
    super();
    this.valueType = null;
  }

  getOutput(index) {
    if (this.valueType === 'Vector2f') {
      return new Amaz.Vector2f(this.inputs[0](), this.inputs[1]());
    } else if (this.valueType === 'Vector3f') {
      return new Amaz.Vector3f(this.inputs[0](), this.inputs[1](), this.inputs[2]());
    } else if (this.valueType === 'Vector4f') {
      return new Amaz.Vector4f(this.inputs[0](), this.inputs[1](), this.inputs[2](), this.inputs[3]());
    } else if (this.valueType === 'Quaternionf') {
      return new Amaz.Quaternionf(this.inputs[0](), this.inputs[1](), this.inputs[2](), this.inputs[3]());
    } else if (this.valueType === 'Rect') {
      return new Amaz.Rect(this.inputs[0](), this.inputs[1](), this.inputs[2](), this.inputs[3]());
    } else if (this.valueType === 'Color') {
      return new Amaz.Color(this.inputs[0](), this.inputs[1](), this.inputs[2](), this.inputs[3]());
    }
  }
}

exports.CGPackNode = CGPackNode;
