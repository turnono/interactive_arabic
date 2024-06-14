const {BaseNode} = require('./BaseNode');
const Amaz = effect.Amaz;
const {clamp} = require('./GraphHelper');

class CGInsertItemToArray extends BaseNode {
  constructor() {
    super();
    this.originalArray = null;
    this.array = null;
  }

  execute() {
    this.array = this.inputs[1]();
    let idx = this.inputs[2]();
    const insertArr = [];

    if (this.array == null || idx == null ) {
      if (this.nexts[0]) {
        this.nexts[0]();
      }
      return;
    }

    if(idx > this.array.length) idx = this.array.length;
    else if(idx < 0) idx = 0;

    if(!this.originalArray){
      this.originalArray = this.array;
    }

    const itemIndex = Math.floor(idx)
    for (let i = 3,j=0; i < this.inputs.length; i++,j++) {
      insertArr[j] = this.inputs[i]()
    }
    
    this.array.splice(itemIndex,0,...insertArr);
    this.outputs[1] = this.array;
    
    if (this.nexts[0]) {
      this.nexts[0]();
    }
  }

  resetOnRecord(sys){
    if(this.array == null || this.array.length === 0) return;
    this.array = this.originalArray;    
  }
}

exports.CGInsertItemToArray = CGInsertItemToArray;
