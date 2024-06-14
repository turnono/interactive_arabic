const Amaz = effect.Amaz;
const {BaseNode} = require('./BaseNode');
const {screenWidth, screenHeight, createRT, addShaderToMap, createQuadMesh, lookAt, lerp, clamp} = require('./GraphHelper');

BRUSH_OPENGLES_VS = `
#ifdef GL_ES
    precision highp float;
#endif
attribute vec3 attPosition;
attribute vec2 attTexcoord0;
uniform mat4 u_View;
uniform mat4 u_Model;
uniform mat4 u_Projection;
varying vec2 uv;

void main() {
    vec4 finalPos = u_Model * vec4(attPosition.x, attPosition.y, attPosition.z, 1.0);
    gl_Position = vec4(finalPos.x * 1280.0/720.0, finalPos.yzw);
    uv = vec2(attTexcoord0.x, attTexcoord0.y);
}
`;

BRUSH_OPENGLES_FS = `
#ifdef GL_ES
precision highp float;
#endif

varying vec2 uv;
uniform vec4 u_BrushColor;
uniform sampler2D u_BrushTexture;

void main() {
    vec2 finalUV = vec2(uv.x, uv.y);
    vec4 finalCol = texture2D(u_BrushTexture, finalUV);
    gl_FragColor = finalCol;
}
`;

BRUSH_METAL_VS = `
#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct main0_out
{
    float2 uv;
    float4 gl_Position [[position]];
};

struct main0_in
{
    float3 attPosition [[attribute(0)]];
    float2 attTexcoord0 [[attribute(1)]];
};

vertex main0_out main0(main0_in in [[stage_in]], constant float4x4& u_Model [[buffer(0)]])
{
    main0_out out = {};
    float4 finalPos = u_Model * float4(in.attPosition.x, in.attPosition.y, in.attPosition.z, 1.0);
    out.gl_Position = float4((finalPos.x * 1280.0) / 720.0, finalPos.yzw);
    out.uv = float2(in.attTexcoord0.x, in.attTexcoord0.y);
    out.gl_Position.z = (out.gl_Position.z + out.gl_Position.w) * 0.5;       // Adjust clip-space for Metal
    return out;
}
`;

BRUSH_METAL_FS = `
#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct main0_out
{
    float4 gl_FragColor [[color(0)]];
};

struct main0_in
{
    float2 uv;
};

fragment main0_out main0(main0_in in [[stage_in]], texture2d<float> u_BrushTexture [[texture(0)]], sampler u_BrushTextureSmplr [[sampler(0)]])
{
    main0_out out = {};
    float2 finalUV = float2(in.uv.x, in.uv.y);
    float4 finalCol = u_BrushTexture.sample(u_BrushTextureSmplr, finalUV);
    out.gl_FragColor = finalCol;
    return out;
}
`;

const drawingState = {
  'IDLE': 0,
  'DRAW': 1,
};

class catmullRomCurve{
  constructor(alpha){
    this.alpha = alpha;
  }

  _getT(t, alpha, p0, p1){
    const d = Amaz.Vector3f.sub(p1, p0);
    const a = d.dot(d);
    const b = Math.pow(a, alpha * 0.5);
    return b + t;
  }

  updatePoints(p0, p1, p2, p3){
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  calPosition(paramT){
    const t0 = 0.0;
    const t1 = this._getT(t0, this.alpha, this.p0, this.p1);
    const t2 = this._getT(t1, this.alpha, this.p1, this.p2);
    const t3 = this._getT(t2, this.alpha, this.p2, this.p3);

    const t = lerp(t1, t2, paramT);

    if(t === t1){
      return this.p1;
    }
    if(t === t2){
      return this.p2;
    }

    const A1  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p0, (t1 - t)/(t1 - t0)), Amaz.Vector3f.mul(this.p1, (t - t0)/(t1 - t0)));
    const A2  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p1, (t2 - t)/(t2 - t1)), Amaz.Vector3f.mul(this.p2, (t - t1)/(t2 - t1)));
    const A3  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p2, (t3 - t)/(t3 - t2)), Amaz.Vector3f.mul(this.p3, (t - t2)/(t3 - t2)));
    const B1  = Amaz.Vector3f.add(Amaz.Vector3f.mul(A1, (t2 - t)/(t2 - t0)), Amaz.Vector3f.mul(A2, (t - t0)/(t2 - t0)));
    const B2  = Amaz.Vector3f.add(Amaz.Vector3f.mul(A2, (t3 - t)/(t3 - t1)), Amaz.Vector3f.mul(A3, (t - t1)/(t3 - t1)));
    const C  = Amaz.Vector3f.add(Amaz.Vector3f.mul(B1, (t2 - t)/(t2 - t1)), Amaz.Vector3f.mul(B2, (t - t1)/(t2 - t1)));

    return C;
  }

  calDerivative(paramT){
    const t0 = 0.0;
    const t1 = this._getT(t0, this.alpha, this.p0, this.p1);
    const t2 = this._getT(t1, this.alpha, this.p1, this.p2);
    const t3 = this._getT(t2, this.alpha, this.p2, this.p3);

    const t = lerp(t1, t2, paramT);


    const A1  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p0, (t1 - t)/(t1 - t0)), Amaz.Vector3f.mul(this.p1, (t - t0)/(t1 - t0)));
    const A2  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p1, (t2 - t)/(t2 - t1)), Amaz.Vector3f.mul(this.p2, (t - t1)/(t2 - t1)));
    const A3  = Amaz.Vector3f.add(Amaz.Vector3f.mul(this.p2, (t3 - t)/(t3 - t2)), Amaz.Vector3f.mul(this.p3, (t - t2)/(t3 - t2)));
    const B1  = Amaz.Vector3f.add(Amaz.Vector3f.mul(A1, (t2 - t)/(t2 - t0)), Amaz.Vector3f.mul(A2, (t - t0)/(t2 - t0)));
    const B2  = Amaz.Vector3f.add(Amaz.Vector3f.mul(A2, (t3 - t)/(t3 - t1)), Amaz.Vector3f.mul(A3, (t - t1)/(t3 - t1)));

    const dA1  = Amaz.Vector3f.mul(Amaz.Vector3f.sub(this.p1, this.p0), 1.0 / (t1 - t0))
    const dA2  = Amaz.Vector3f.mul(Amaz.Vector3f.sub(this.p2, this.p1), 1.0 / (t2 - t1))
    const dA3  = Amaz.Vector3f.mul(Amaz.Vector3f.sub(this.p3, this.p2), 1.0 / (t3 - t2))
    const dB1  = Amaz.Vector3f.add(Amaz.Vector3f.add(Amaz.Vector3f.mul(Amaz.Vector3f.sub(A2, A1), 1.0 /(t2 - t0)), Amaz.Vector3f.mul(dA1, (t2 - t)/(t2 - t0))), Amaz.Vector3f.mul(dA2, (t - t0)/(t2 - t0)));
    const dB2  = Amaz.Vector3f.add(Amaz.Vector3f.add(Amaz.Vector3f.mul(Amaz.Vector3f.sub(A3, A2), 1.0 /(t3 - t1)), Amaz.Vector3f.mul(dA2, (t3 - t)/(t3 - t1))), Amaz.Vector3f.mul(dA3, (t - t1)/(t3 - t1)));
    const dC  = Amaz.Vector3f.add(Amaz.Vector3f.add(Amaz.Vector3f.mul(Amaz.Vector3f.sub(B2, B1), 1.0/(t2 - t1)), Amaz.Vector3f.mul(dB1, (t2 - t)/(t2 - t1))), Amaz.Vector3f.mul(dB2, (t - t1)/(t2 - t1)));

    return dC;
  }
}

function screenToNormalize(screenVec3){
  const normalizePt = new Amaz.Vector3f((screenVec3.x * 2.0 - 1.0) * screenWidth/screenHeight, screenVec3.y * 2.0 - 1.0, 0.0);
  return normalizePt;
}

class CGBrush extends BaseNode {
  constructor() {
    super();
    this.blitCB = new Amaz.CommandBuffer();
    this.brushCB = new Amaz.CommandBuffer();
    this.clearCB = new Amaz.CommandBuffer();
    this.inputTexture = null;
    this.cameraList = [];
    this.cameraCount = 0;
    this.customMatBlitTexture = null;
    this.brushMaterial = null;
    this.brushTexture = null;
    this.sys = null;
    this.enable = false;
    this.time = 0.0;
    this.lastPosition = null;
    this.controlPts = [];
    this.lastQuat = new Amaz.Quaternionf();
    this.state = drawingState.IDLE;
    this.time = 0.0;
    this.counter = 0;
    this.density = 0.0;
    this.indexCounter = 0;
  }

  _createMaterialWithShaderMap(shaders) {
    const material = new Amaz.Material();
    const xShader = new Amaz.XShader();
    const pass = new Amaz.Pass();

    pass.shaders = shaders;
    const sematicsMap = new Amaz.Map();
    sematicsMap.insert('attPosition', Amaz.VertexAttribType.POSITION);
    sematicsMap.insert('attTexcoord0', Amaz.VertexAttribType.TEXCOORD0);

    pass.semantics = sematicsMap;

    //render state
    const renderState = new Amaz.RenderState();

    //depth state
    const depthStencilState = new Amaz.DepthStencilState();
    depthStencilState.depthTestEnable = false;
    depthStencilState.depthWriteEnable = false;
    renderState.depthstencil = depthStencilState;

    // Rect
    renderState.viewport = new Amaz.ViewportState();
    renderState.viewport.rect = new Amaz.Rect(0, 0, 1, 1); // value int percentage by default
    renderState.viewport.minDepth = 0;
    renderState.viewport.maxDepth = 1;

    // add color blend
    let colorBlendState = new Amaz.ColorBlendState()
    const attVec = new Amaz.Vector()
    const attState = new Amaz.ColorBlendAttachmentState()
    attState.blendEnable = true;
    attState.srcColorBlendFactor = Amaz.BlendFactor.SRC_ALPHA
    attState.dstColorBlendFactor = Amaz.BlendFactor.ONE_MINUS_SRC_ALPHA
    attState.srcAlphaBlendFactor = Amaz.BlendFactor.SRC_ALPHA
    attState.dstAlphaBlendFactor = Amaz.BlendFactor.ONE_MINUS_SRC_ALPHA
    attState.ColorBlendOp = Amaz.BlendOp.ADD
    attState.AlphaBlendOp = Amaz.BlendOp.MAX
    
    attVec.pushBack(attState)
    colorBlendState.attachments = attVec;

    renderState.colorBlend = colorBlendState;

    pass.renderState = renderState;
    pass.useFBOFetch = false;
    pass.useFBOTexture = false;
    xShader.passes.pushBack(pass);
    material.xshader = xShader;
    return material;
  }

  _initProjMatrix(){
    const aspectRatio = screenWidth/screenHeight;
    // Default Ortho Scale, Aligned to the tool default
    // Meanwhile default Pixel Per Unit is 32
    // Default Near is 0.1, default far is 1000
    const orthoScale = 20;
    const zNear = 0.1;
    const zFar = 1000.0;
    const halfHeight = orthoScale;
    const halfWidth = aspectRatio * halfHeight;

    const orthoProjMat = new Amaz.Matrix4x4f();
    orthoProjMat.setOrtho(-halfWidth, halfWidth, -halfHeight, halfHeight, zNear, zFar);

    const projMat = new Amaz.Matrix4x4f();
    projMat.setPerspective(60.0, screenWidth/screenHeight, 0.1, 100.0);
    return orthoProjMat;
  }

  _clearBrushTexture(){
    this.brushCB.clearAll();
    this.blitCB.clearAll();
    this.clearCB.clearAll();

    this.clearCB.setRenderTexture(this.brushTexture);
    this.clearCB.clearRenderTexture(true, true, new Amaz.Color(0.0, 0.0, 0.0, 0.0), 0);

    const clearTex = new Amaz.Texture2D();
    clearTex.filterMin = Amaz.FilterMode.LINEAR;
    clearTex.filterMag = Amaz.FilterMode.LINEAR;
    clearTex.width = screenWidth;
    clearTex.height = screenHeight;
    clearTex.depth = 1;
    clearTex.internalFormat = Amaz.InternalFormat.RGBA8
    clearTex.dataType = Amaz.DataType.U8norm
    clearTex.filterMipmap = Amaz.FilterMipmapMode.FilterMode_NONE

    if(this.clearRT === null){
      this.clearRT = createRT(screenWidth, screenHeight);
    }
    
    this.blitCB.setRenderTexture(this.customMatBlitTexture);
    this.blitCB.clearRenderTexture(true, true, new Amaz.Color(0.0, 0.0, 0.0, 0.0), 0);
    this.brushCB.setRenderTexture(this.clearRT);
    this.brushCB.clearRenderTexture(true, true, new Amaz.Color(0.0, 0.0, 0.0, 0.0), 0);
    this.clearCB.blit(this.clearRT, this.brushTexture);
    this.sys.scene.commitCommandBuffer(this.brushCB);
    this.sys.scene.commitCommandBuffer(this.blitCB);
    this.sys.scene.commitCommandBuffer(this.clearCB);
  }


  _initCustomMaterialBlitCB(){
    if(this.customMatBlitTexture == null){
      this.customMatBlitTexture = createRT(screenHeight, screenHeight);
    }

    const identityMat = new Amaz.Matrix4x4f();
    identityMat.setIdentity();

    this.blitCB.clearAll();
    this.blitCB.setRenderTexture(this.customMatBlitTexture);

    this.customMaterial.setMat4('u_Model', identityMat);
    this.customMaterial.setMat4('u_View', identityMat);
    this.customMaterial.setMat4('u_Projection', identityMat);
    this.customMaterial.setMat4('u_MVP', identityMat);
    this.customMaterial.setMat4('u_TransposeInvModel', identityMat);
    this.blitCB.drawMesh(this.quadMesh, identityMat , this.customMaterial, 0,0, null);
  }

  _initBrushCB(tex){
    // Step 2: Render the quad mesh texture as stroke texture to a sequence of brush
    if (this.brushTexture === null) {
      this.brushTexture = createRT(screenWidth, screenHeight);
    }

    const viewMatrix = lookAt(new Amaz.Vector3f(0.0, 0.0, 40.0), new Amaz.Vector3f(0.0,0.0,0.0),  new Amaz.Vector3f(0.0,1.0,0.0));
    const transformMatrix = new Amaz.Matrix4x4f();
    transformMatrix.setIdentity();

    // Do not render first frame; only for binding
    transformMatrix.setScale(new Amaz.Vector3f(0.0,0.0,0.0));

    this.brushCB.clearAll();
    this.brushCB.setRenderTexture(this.brushTexture);
    this.brushCB.setViewMatrix(viewMatrix);
    this.brushCB.setProjectionMatrix(this.projMat);
    this.brushMaterial.setVec4('u_BrushColor', new Amaz.Vector4f(1.0,0.5,1.0,1.0));
    this.brushMaterial.setTex('u_BrushTexture', tex);

    this.brushCB.drawMesh(this.quadMesh, transformMatrix , this.brushMaterial, 0,0, null);
  }

  _checkTouchOutOfScreen(pos){
    return pos.x < 0 || pos.y < 0 || pos.x > 1 || pos.y > 1;
  }

  _checkNewTouchTooClose(pos){
    return this.lastPosition && this.lastPosition.distance(pos) < 0.005;
  }

  _renderBrushStroke(){
    // Step 3: Perform drawing and interpolation
    const pos = this.inputs[4]();
    const scale = this.inputs[5]();
    const rotateStroke = this.inputs[7]();

    if(this._checkTouchOutOfScreen(pos)){
      return;
    }

    if(this._checkNewTouchTooClose(pos)){
      return;
    }

    if(this.lastPosition === null){
      this.lastPosition = pos;
    }

    // Draw Smooth curve
    if(this.controlPts.length < 4){
      this.controlPts.push(screenToNormalize(pos));
      if(this.density > 1) return;
    }else{
      this.controlPts.shift();
      this.controlPts.push(screenToNormalize(pos));
      this.catmullRomCurve.updatePoints(...this.controlPts);
    }


    const quat = new Amaz.Quaternionf();
    const transformMatrix = new Amaz.Matrix4x4f();
    const viewMatrix = lookAt(new Amaz.Vector3f(0.0, 0.0, 40.0), new Amaz.Vector3f(0.0,0.0,0.0),  new Amaz.Vector3f(0.0,1.0,0.0));
    transformMatrix.setIdentity();

    this.blitCB.clearAll();
    this.blitCB.setRenderTexture(this.customMatBlitTexture);
    this.blitCB.drawMesh(this.quadMesh, transformMatrix , this.customMaterial, 0,0, null);

    this.brushCB.clearAll();
    this.brushCB.setRenderTexture(this.brushTexture);
    this.brushCB.setViewMatrix(viewMatrix);
    this.brushCB.setProjectionMatrix(this.projMat);

    if(this.density > 1){
      for(let i = 0; i < this.density; ++i){
        const t = i/this.density;
        const catmullRomPos = this.catmullRomCurve.calPosition(t);
        const catmullRomDerivative = this.catmullRomCurve.calDerivative(t);
  
        let quatCurrent = new Amaz.Quaternionf();
        if(rotateStroke){
          quatCurrent = quat.lookRotationToQuaternion(new Amaz.Vector3f(0,0,1.0), catmullRomDerivative);
        }
        transformMatrix.setTRS(catmullRomPos, quatCurrent, new Amaz.Vector3f(scale,scale,scale));
        
        this.brushMaterial.setTex('u_BrushTexture', this.customMatBlitTexture);
        this.brushCB.drawMesh(this.quadMesh, transformMatrix , this.brushMaterial, 0,0, null);
      }
    }
    else{
      if(this.indexCounter === 0){
        let quatCurrent = new Amaz.Quaternionf();
        const direction = screenToNormalize(pos).sub(screenToNormalize(this.lastPosition));
        if(rotateStroke){
          quatCurrent = quat.lookRotationToQuaternion(new Amaz.Vector3f(0,0,1.0), direction);
        }
        transformMatrix.setTRS(screenToNormalize(pos), quatCurrent, new Amaz.Vector3f(scale,scale,scale));
        this.brushMaterial.setTex('u_BrushTexture', this.customMatBlitTexture);
        this.brushCB.drawMesh(this.quadMesh, transformMatrix , this.brushMaterial, 0,0, null);
      }
      this.indexCounter  = this.indexCounter + 1;
      if(this.indexCounter * this.density >= 1){
        this.indexCounter = 0;
      }
    }

    this.sys.scene.commitCommandBuffer(this.blitCB);
    this.sys.scene.commitCommandBuffer(this.brushCB);

    this.lastPosition = pos;
  }

  _disableDepthState(mat){
    let passes = mat.xshader.passes;
    if (passes && passes.size() > 0) {
        for(let passNum = 0; passNum < passes.size(); passNum ++) {
            let depthStencil = mat.xshader.passes.get(passNum).renderState.depthstencil;
            if(depthStencil){
              depthStencil.depthTestEnable = false;
              depthStencil.depthWriteEnable = false;
            }
        }
    }

    return mat;
  }

  getOutput(index) {
    switch(index){
      case 0:
        return this.brushTexture;
    } 
  }

  execute(index) {    
    switch(index){
      // 0: Start
      case 0:
        this.state = drawingState.DRAW;
        break;
      // 1: Stop
      case 1:
        this.state = drawingState.IDLE;
        this.lastPosition = null;
        this.controlPts = [];
        this.indexCounter = 0;
        break;
      // 2 Clear
      case 2:
        this._clearBrushTexture();
        this.state = drawingState.IDLE;
        this.lastPosition = null;
        this.controlPts = [];
        this.indexCounter = 0;
        break;
      default:
        break;
    }
  }

  beforeStart(sys) {
    this.sys = sys;

    // 0 Initialize Quad Mesh
    this.quadMesh = createQuadMesh();
    this.projMat = this._initProjMatrix();

    // 1.2: Blit Custom Material on to a RT with a full-screen Quad mesh
    const matArray = this.inputs[3]();
    if(matArray && matArray[0]){
      const inputMaterial = matArray[0];
      this.customMaterial = this._disableDepthState(inputMaterial);
      this._initCustomMaterialBlitCB();
    }
    
    // 2.1: Initialize Brush Material
    const brushShaders = new Amaz.Map();
    addShaderToMap(brushShaders, 'gles2', BRUSH_OPENGLES_VS, BRUSH_OPENGLES_FS);
    addShaderToMap(brushShaders, 'metal', BRUSH_METAL_VS, BRUSH_METAL_FS);
    this.brushMaterial = this._createMaterialWithShaderMap(brushShaders);

    // 2.2: Bind Paint material Blit RT onto output RT
    this._initBrushCB(this.customMatBlitTexture);

    // initialize Centripetal Catmull–Rom spline
    this.catmullRomCurve = new catmullRomCurve(0.5);

    this._clearBrushTexture();
  }

  onUpdate(sys, dt){
    const inputDensity = this.inputs[6]();
    if(inputDensity === null || inputDensity === undefined) return;

    this.density = clamp(inputDensity, 0, 100);

    // 1.2: Blit Custom Material on to a RT with a full-screen Quad mesh
    const matArray = this.inputs[3]();
    if(matArray && matArray[0]){
      const inputMaterial = matArray[0];
      this.customMaterial = this._disableDepthState(inputMaterial);
    }
    if(this.state === drawingState.DRAW){
      this._renderBrushStroke();
    }
  }

  resetOnRecord(sys){            
    this._clearBrushTexture();
    this.state = drawingState.IDLE;
    this.lastPosition = null;
    this.controlPts = [];
    this.indexCounter = 0;
  }

  onDestroy() {
    this.blitCB = null;
    this.brushCB = null;
    this.clearCB = null;

    this.customMatBlitTexture = null;
    this.brushTexture = null;
  }
}

exports.CGBrush = CGBrush;
