/**
 * @file CGScreenPan.js
 * @author liujiacheng
 * @date 2021/8/23
 * @brief CGScreenPan.js
 * @copyright Copyright (c) 2021, ByteDance Inc, All Rights Reserved
 */

const {BaseNode} = require('./BaseNode');
const APJS = require('./amazingpro');

const {BEMessage} = require('./BEMessage');
const BEMsg = BEMessage.ScreenEvent;
class CGScreenPan extends BaseNode {
  constructor() {
    super();
    this.offset = new APJS.Vector2f(0.0, 0.0);
    this.position = new APJS.Vector2f(-1.0, -1.0);
    this.startPoint = new APJS.Vector2f(-1.0, -1.0);
  }

  beforeStart(sys) {
    sys.eventListener.registerListener(
      APJS.AmazingManager.getSingleton('Input'),
      APJS.InputListener.ON_GESTURE_DRAG,
      sys.APJScript,
      sys.APJScript
    );
  }

  onDestroy(sys) {
    sys.eventListener.removeListener(
      APJS.AmazingManager.getSingleton('Input'),
      APJS.InputListener.ON_GESTURE_DRAG,
      sys.APJScript,
      sys.APJScript
    );
  }

  onEvent(sys, event) {
    if (event.type === APJS.EventType.TOUCH) {
      const touch = event.args.get(0);
      if (touch.type === APJS.TouchType.TOUCH_BEGAN) {
        this.startPoint = new APJS.Vector2f(touch.x, touch.y);
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
    if (eventType !== APJS.InputListener.ON_GESTURE_DRAG) {
      return;
    }

    if (sender !== null) {
      this.offset = new APJS.Vector2f(sender.x - this.startPoint.x, this.startPoint.y - sender.y);
      this.position = new APJS.Vector2f(sender.x, 1.0 - sender.y);
      if (this.nexts[0]) {
        this.nexts[0]();
      }
      if (sys.APJScene) {
        sys.APJScene.postMessage(BEMsg.msgId, BEMsg.action.ScreenPan.id, 0, '');
      }
    }
  }

  resetOnRecord(sys){
    this.startPoint = new APJS.Vector2f(-1.0, -1.0);
    this.offset = new APJS.Vector2f(0.0, 0.0);
    this.position = new APJS.Vector2f(-1.0, -1.0);
  }
}

exports.CGScreenPan = CGScreenPan;
