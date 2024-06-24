const {BaseNode} = require('./BaseNode');
const Amaz = effect.Amaz;

const PointerState = {
  UNINIT: 'UNINIT',
  RIGHT: 'RIGHT',
  FINISH: 'FINISH',
};

class Pointer {
  constructor() {
    this.Idle = true;
    this.OnStart = false;
    this.Stay = false;
    this.OnStop = false;
    this.id = undefined;
    this.currentPos = new Amaz.Vector2f(-1.0, -1.0);
    this.lastPos = new Amaz.Vector2f(-1.0, -1.0);
    this.state = PointerState.UNINIT;
  }
}

class OnePointTouch extends BaseNode {
  constructor() {
    super();
    this.Pointer0 = new Pointer();
    this.Pointer1 = new Pointer();

    this.touchIdxMap = {
      'Touch 0': 0,
      'Touch 1': 1,
    }
    this.pointers = [this.Pointer0, this.Pointer1];
  }

  onEvent(sys, event) {
    if (event.type === Amaz.EventType.TOUCH) {
      this._handleTouchEvent(event);
    }
  }

  onLateUpdate(sys, dt) {
    this.selectedIndex = this.touchIdxMap[this.inputs[0]()];
    this.selectedPointer = this.pointers[this.selectedIndex];

    this.outputs[4] = this.selectedPointer.currentPos;
    this.outputs[5] = this.selectedPointer.lastPos;

    if (this.selectedPointer.Idle && this.nexts[0]) {
      //P1 Idle Event Port
      this.nexts[0]();
    } else {
      //P1 Stay
      this._excuteTouchPoint(this.selectedIndex);
    }

    if (this.selectedPointer.OnStop) {
      this._setPointer(
        this.selectedPointer,
        undefined,
        PointerState.UNINIT,
        true,
        false,
        false,
        false,
        new Amaz.Vector2f(-1.0,-1.0),
        new Amaz.Vector2f(this.selectedPointer.currentPos.x, this.selectedPointer.currentPos.y)
      );
    }
  }

  _handleTouchEvent(event) {
    const pointer = event.args.get(0);
    if (pointer !== undefined) {
      const type = pointer.type;
      if (type === Amaz.TouchType.TOUCH_BEGAN) {
        if (this.Pointer0.state === PointerState.UNINIT || this.Pointer0.state === PointerState.FINISH) {
          this._setPointer(
            this.Pointer0,
            pointer.pointerId,
            PointerState.RIGHT,
            false,
            true,
            false,
            false,
            new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
            new Amaz.Vector2f(-1.0,-1.0),
          );
        } else if (this.Pointer1.state === PointerState.UNINIT || this.Pointer1.state === PointerState.UNINIT) {
          if(pointer.pointerId !== this.Pointer0.id){
            this._setPointer(
              this.Pointer1,
              pointer.pointerId,
              PointerState.RIGHT,
              false,
              true,
              false,
              false,
              new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
              new Amaz.Vector2f(-1.0,-1.0)
            );
          }
        }
      } else if (type === Amaz.TouchType.TOUCH_MOVED) {
        if (this.Pointer0.state === PointerState.RIGHT && pointer.pointerId === this.Pointer0.id) {
          this._setPointer(
            this.Pointer0,
            pointer.pointerId,
            PointerState.RIGHT,
            false,
            false,
            true,
            false,
            new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
            new Amaz.Vector2f(this.Pointer0.currentPos.x, this.Pointer0.currentPos.y)
          );
        } else if (this.Pointer1.state === PointerState.RIGHT && pointer.pointerId === this.Pointer1.id) {
          this._setPointer(
            this.Pointer1,
            pointer.pointerId,
            PointerState.RIGHT,
            false,
            false,
            true,
            false,
            new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
            new Amaz.Vector2f(this.Pointer1.currentPos.x, this.Pointer1.currentPos.y)
          );
        }
      } else if (type === Amaz.TouchType.TOUCH_ENDED) {
        if (this.Pointer0.state === PointerState.RIGHT && pointer.pointerId === this.Pointer0.id) {
          this._setPointer(
            this.Pointer0,
            pointer.pointerId,
            PointerState.FINISH,
            false,
            false,
            false,
            true,
            new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
            new Amaz.Vector2f(this.Pointer0.currentPos.x, this.Pointer0.currentPos.y)
          );
        } else if (this.Pointer1.state === PointerState.RIGHT && pointer.pointerId === this.Pointer1.id) {
          this._setPointer(
            this.Pointer1,
            pointer.pointerId,
            PointerState.FINISH,
            false,
            false,
            false,
            true,
            new Amaz.Vector2f(pointer.x, 1.0 - pointer.y),
            new Amaz.Vector2f(this.Pointer1.currentPos.x, this.Pointer1.currentPos.y)
          );
        }
      }
      this._excuteTouchPoint(this.selectedIndex);
    }
  }

  _setPointer(pointer, id, state, Idle, OnStart, Stay, OnStop, currentPos, lastPos) {
    pointer.Idle = Idle;
    pointer.OnStart = OnStart;
    pointer.Stay = Stay;
    pointer.OnStop = OnStop;
    pointer.currentPos = currentPos;
    pointer.lastPos = lastPos;
    pointer.id = id;
    pointer.state = state;
  }

  _excuteTouchPoint(index){
    const selectedPointer = this.pointers[index];

    this.outputs[4] = selectedPointer.currentPos;
    this.outputs[5] = selectedPointer.lastPos;
    if (selectedPointer.OnStart && this.nexts[1]) {
      this.nexts[1]();
    }
    if(selectedPointer.Stay && this.nexts[2]) {
      this.nexts[2]();
    }
    if(selectedPointer.OnStop && this.nexts[3]) {
      this.nexts[3]();
    }  
  }

  _reset() {
    for(let pointer of this.pointers){
      this._setPointer(pointer, undefined, PointerState.UNINIT, true, false, false, false, new Amaz.Vector2f(-1.0, -1.0), new Amaz.Vector2f(-1.0, -1.0));
    }
    this.outputs[4] = new Amaz.Vector2f(-1.0, -1.0);
    this.outputs[5] = new Amaz.Vector2f(-1.0, -1.0);
  }

  beforeStart(sys) {
    this._reset();
  }

  resetOnRecord(sys){    
    this._reset();
  }
}

exports.OnePointTouch = OnePointTouch;