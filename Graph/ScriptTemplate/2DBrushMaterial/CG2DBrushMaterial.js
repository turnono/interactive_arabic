const APJS = require('./amazingpro');
const {BaseNode} = require('./BaseNode');
const {addShaderToMap} = require('./GraphHelper');

const CUS_BRUSH_OPENGLES_VS = `
#ifdef GL_ES
    precision highp float;
#endif
attribute vec3 attPosition;
attribute vec2 attTexcoord0;
varying vec2 uv;

void main() {
    gl_Position = vec4(attPosition.x, attPosition.y, attPosition.z, 1.0);       
    uv = vec2(attTexcoord0.x, attTexcoord0.y);
}
`;

const CUS_BRUSH_OPENGLES_FS = `
#ifdef GL_ES
precision highp float;
#endif

varying vec2 uv;
uniform int USE_TEXTURE;
uniform int USE_FEATHERING;
uniform float Custom_Float_1;
uniform vec4 Custom_Color_1;
uniform sampler2D Custom_Texture_1;

void main() {
    float dist = sqrt((uv.x - 0.5) * (uv.x - 0.5) + (uv.y - 0.5)*(uv.y - 0.5));
    vec4 texCol = texture2D(Custom_Texture_1, uv);
    vec4 blendCol = texCol * Custom_Color_1;
    blendCol = mix(Custom_Color_1, blendCol, float(USE_TEXTURE));
    float thresh = (1.0 - Custom_Float_1) / 2.0;
    float finalAlpha = (1.0 - dist * 2.0) / (Custom_Float_1 + 0.00001);
    finalAlpha = mix(1.0, finalAlpha, step(thresh, dist));
    finalAlpha = mix(1.0, finalAlpha, float(USE_FEATHERING));
    vec4 finalCol = vec4(blendCol.rgb, finalAlpha);
    gl_FragColor = finalCol;
}
`;

const CUS_BRUSH_METAL_VS = `
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

vertex main0_out main0(main0_in in [[stage_in]])
{
    main0_out out = {};
    out.gl_Position = float4(in.attPosition.x, in.attPosition.y, in.attPosition.z, 1.0);
    out.uv = float2(in.attTexcoord0.x, in.attTexcoord0.y);
    out.gl_Position.z = (out.gl_Position.z + out.gl_Position.w) * 0.5;       // Adjust clip-space for Metal
    return out;
}
`

const CUS_BRUSH_METAL_FS = `
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

fragment main0_out main0(main0_in in [[stage_in]], constant int& USE_TEXTURE [[buffer(1)]], constant int& USE_FEATHERING [[buffer(3)]], constant float4& Custom_Color_1 [[buffer(0)]], constant float& Custom_Float_1 [[buffer(2)]], texture2d<float> Custom_Texture_1 [[texture(0)]], sampler Custom_Texture_1Smplr [[sampler(0)]])
{
    main0_out out = {};
    float dist = sqrt(((in.uv.x - 0.5) * (in.uv.x - 0.5)) + ((in.uv.y - 0.5) * (in.uv.y - 0.5)));
    float4 texCol = Custom_Texture_1.sample(Custom_Texture_1Smplr, in.uv);
    float4 blendCol = texCol * Custom_Color_1;
    blendCol = mix(Custom_Color_1, blendCol, float4(float(USE_TEXTURE)));
    float thresh = (1.0 - Custom_Float_1) / 2.0;
    float finalAlpha = (1.0 - (dist * 2.0)) / (Custom_Float_1 + 0.00001);
    finalAlpha = mix(1.0, finalAlpha, step(thresh, dist));
    finalAlpha = mix(1.0, finalAlpha, float(USE_FEATHERING));
    float4 finalCol = float4(blendCol.xyz, finalAlpha);
    out.gl_FragColor = finalCol;
    return out;
}

`

class CG2DBrushMaterial extends BaseNode{
  constructor(){
    super();
  }

  _createMaterialWithShaderMap(shaders) {
    const material = new APJS.Material();
    const xShader = new APJS.XShader();
    const pass = new APJS.Pass();

    pass.shaders = shaders;
    const sematicsMap = new APJS.Map();
    sematicsMap.insert('attPosition', APJS.VertexAttribType.POSITION);
    sematicsMap.insert('attTexcoord0', APJS.VertexAttribType.TEXCOORD0);

    pass.semantics = sematicsMap;

    //render state
    const renderState = new APJS.RenderState();

    //depth state
    const depthStencilState = new APJS.DepthStencilState();
    depthStencilState.depthTestEnable = false;
    renderState.depthstencil = depthStencilState;

    // Rect
    renderState.viewport = new APJS.ViewportState();
    renderState.viewport.rect = new APJS.Rect(0, 0, 1, 1) // value int percentage by default
    renderState.viewport.minDepth = 0
    renderState.viewport.maxDepth = 1

    // add color blend
    let colorBlendState = new APJS.ColorBlendState()
    const attVec = new APJS.Vector()
    const attState = new APJS.ColorBlendAttachmentState()
    attState.blendEnable = true;
    attState.srcColorBlendFactor = APJS.BlendFactor.ONE
    attState.dstColorBlendFactor = APJS.BlendFactor.ZERO
    attState.srcAlphaBlendFactor = APJS.BlendFactor.ONE
    attState.dstAlphaBlendFactor = APJS.BlendFactor.ZERO
    attState.ColorBlendOp = APJS.BlendOp.ADD
    attState.AlphaBlendOp = APJS.BlendOp.ADD
    attVec.pushBack(attState)
    colorBlendState.attachments = attVec;

    renderState.colorBlend = colorBlendState;

    pass.renderState = renderState;
    xShader.passes.pushBack(pass);
    material.xshader = xShader;

    const texPlaceholderDesc = new APJS.Texture2DCreateDesc();
    texPlaceholderDesc.filterMin = APJS.FilterMode.NEAREST;
    texPlaceholderDesc.filterMag = APJS.FilterMode.NEAREST;
    const texPlaceholder = APJS.TextureUtils.createPlaceHolderTexture(texPlaceholderDesc);
    


    const props = new APJS.PropertySheet();

    props.setInt('Using_PlaceholderMaterial', 1);
    props.setInt('USE_TEXTURE', 0);
    props.setInt('USE_FEATHERING', 1);
    props.setFloat('Custom_Float_1', 0.0)
    props.setVec4('Custom_Color_1', new APJS.Vector4f(0.41, 0.41, 0.41 ,1.0));
    props.setTex('Custom_Texture_1', texPlaceholder);
    
    material.properties = props;
    material.setFloat('Custom_Float_1', 0.0)
    material.setVec4('Custom_Color_1', new APJS.Vector4f(0.41, 0.41, 0.41 ,1.0));
    material.setTex('Custom_Texture_1', texPlaceholder);
    material.setInt('USE_TEXTURE', 0);
    material.setInt('USE_FEATHERING', 1);

    return material;
  }


  _initMaterials(){
    const brushShaders = new APJS.Map();
    addShaderToMap(brushShaders, 'gles2', CUS_BRUSH_OPENGLES_VS, CUS_BRUSH_OPENGLES_FS);
    addShaderToMap(brushShaders, 'metal', CUS_BRUSH_METAL_VS, CUS_BRUSH_METAL_FS);
    this.brushMaterial = this._createMaterialWithShaderMap(brushShaders);
    
    this.skinBrushMaterial = this.brushMaterial.instantiate();
    this.skinBrushMaterial.enableMacro('AE_AMAZING_USE_BONES', 1);
  }

  beforeStart(sys){
    this._initMaterials();
  }

  getOutput(index){
    if(!this.brushMaterial){
      this._initMaterials();
    }
    return [this.brushMaterial, this.skinBrushMaterial];
  }
}

exports.CG2DBrushMaterial = CG2DBrushMaterial;