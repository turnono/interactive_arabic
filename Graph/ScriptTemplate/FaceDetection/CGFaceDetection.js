/**
 * @file CGFaceDetection.js
 * @author liujiacheng
 * @date 2021/8/18
 * @brief CGFaceDetection.js
 * @copyright Copyright (c) 2021, ByteDance Inc, All Rights Reserved
 */

const {BaseNode} = require('./BaseNode');
const Amaz = effect.Amaz;

const {BEMessage, BEState} = require('./BEMessage');
const BEMsg = BEMessage.FaceDetection;
class CGFaceDetection extends BaseNode {
  constructor() {
    super();
    this.faceIndexMap = {
      'Face 0': 0,
      'Face 1': 1,
      'Face 2': 2,
      'Face 3': 3,
      'Face 4': 4,
    };
    this.faceCount = 0;
    this.lastAction = BEState.None.key;
  }

  onUpdate(sys, dt) {
    const algMgr = Amaz.AmazingManager.getSingleton('Algorithm');
    const algResult = algMgr.getAEAlgorithmResult();
    const curFaceCount = algResult.getFaceCount();
    const faceIdxInput = this.inputs[0]();

    if (faceIdxInput === null) {
      return;
    }
    this.outputs[4] = curFaceCount;
    const faceIdx = this.faceIndexMap[faceIdxInput];
    if (faceIdx === undefined) {
      return;
    }
    if (this.faceCount <= faceIdx && curFaceCount > faceIdx) {
      if (this.nexts[0]) {
        this.nexts[0]();
      }
      if (sys.scene && this.lastAction !== BEState.Begin.key) {
        this.lastAction = BEState.Begin.key;
        sys.scene.postMessage(BEMsg.msgId, BEMsg.action.Detect_Status.id, BEState.Begin.id, '');
      }
    }
    if (curFaceCount > faceIdx) {
      if (this.nexts[1]) {
        this.nexts[1]();
      }
      if (sys.scene && this.lastAction !== BEState.Stay.key) {
        this.lastAction = BEState.Stay.key;
        sys.scene.postMessage(BEMsg.msgId, BEMsg.action.Detect_Status.id, BEState.Stay.id, '');
      }
    }
    if (this.faceCount > faceIdx && curFaceCount <= faceIdx) {
      if (this.nexts[2]) {
        this.nexts[2]();
      }
      if (sys.scene && this.lastAction !== BEState.End.key) {
        this.lastAction = BEState.End.key;
        sys.scene.postMessage(BEMsg.msgId, BEMsg.action.Detect_Status.id, BEState.End.id, '');
      }
    }
    if (curFaceCount <= faceIdx) {
      if (this.nexts[3]) {
        this.nexts[3]();
      }
      if (sys.scene && this.lastAction !== BEState.None.key) {
        this.lastAction = BEState.None.key;
        sys.scene.postMessage(BEMsg.msgId, BEMsg.action.Detect_Status.id, BEState.None.id, '');
      }
    }

    this.faceCount = curFaceCount;
  }

  resetOnRecord(sys){
    this.faceCount = 0;
    this.lastAction = BEState.None.key;
  }
}

exports.CGFaceDetection = CGFaceDetection;
