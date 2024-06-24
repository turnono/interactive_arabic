/**
 * @file CGScreenPan.js
 * @author liujiacheng
 * @date 2021/8/23
 * @brief CGScreenPan.js
 * @copyright Copyright (c) 2021, ByteDance Inc, All Rights Reserved
 */

const {BaseNode} = require('./BaseNode');
const Amaz = effect.Amaz;

const {BEMessage} = require('./BEMessage');
const BEMsg = BEMessage.ScreenEvent;
class CGScreenPan extends BaseNode {
  constructor() {
    super();
    this.offset = new Amaz.Vector2f(0.0, 0.0);
    this.position = new Amaz.Vector2f(-1.0, -1.0);
    this.startPoint = new Amaz.Vector2f(-1.0, -1.0);
  }

  beforeStart(sys) {
    sys.eventListener.registerListener(
      Amaz.AmazingManager.getSingleton('Input'),
      Amaz.InputListener.ON_GESTURE_DRAG,
      sys.script,
      sys.script
    );
  }

  onDestroy(sys) {
    sys.eventListener.removeListener(
      Amaz.AmazingManager.getSingleton('Input'),
      Amaz.InputListener.ON_GESTURE_DRAG,
      sys.script,
      sys.script
    );
  }

  onEvent(sys, event) {
    if (event.type === Amaz.EventType.TOUCH) {
      const touch = event.args.get(0);
      if (touch.type === Amaz.TouchType.TOUCH_BEGAN) {
        this.startPoint = new Amaz.Vector2f(touch.x, touch.y);
      }
    }
  }

  getOutput(index){
    switch(index){
      case 1:
        return this.offset;
      case 2:
        return this.position;
    }
  }

  onCallBack(sys, sender, eventType) {
    if (eventType !== Amaz.InputListener.ON_GESTURE_DRAG) {
      return;
    }

    if (sender !== null) {
      this.offset = new Amaz.Vector2f(sender.x - this.startPoint.x, this.startPoint.y - sender.y);
      this.position = new Amaz.Vector2f(sender.x, 1.0 - sender.y);
      if (this.nexts[0]) {
        this.nexts[0]();
      }
      if (sys.scene) {
        sys.scene.postMessage(BEMsg.msgId, BEMsg.action.ScreenPan.id, 0, '');
      }
    }
  }

  resetOnRecord(sys){
    this.startPoint = new Amaz.Vector2f(-1.0, -1.0);
    this.offset = new Amaz.Vector2f(0.0, 0.0);
    this.position = new Amaz.Vector2f(-1.0, -1.0);
  }
}

exports.CGScreenPan = CGScreenPan;
