declare var OffscreenCanvas: any;
import "./glsl2";

import React, { useEffect } from "react";

export function GPGPUPlayground() {
  useEffect(() => {
    const inputs = [
      { name: "vecA", buffer: new Float32Array([1.0, 2.0, 3.0, 4.0]), size: 4 },
      { name: "vecB", buffer: new Float32Array([5.0, 6.0, 7.0, 8.0]), size: 4 }
    ];
    const output = {
      size: 4,
      bufferSize: Float32Array.BYTES_PER_ELEMENT * 4,
      name: "result"
    };

    const vertexShaderSource = `#version 300 es
  in vec4 vecA;
  in vec4 vecB;
  out vec4 result;
  
  void main() {
    result = vecA + vecB;
  }
  `;

    runGPGPU(vertexShaderSource, inputs, output);
  }, []);
  return <div>foo</div>;
}

const dummyFragmentShaderSource = `#version 300 es

precision highp float;

out vec4 fragmentColor;

void main() {
  fragmentColor = vec4(1.0);
}
`;

function runGPGPU(
  shaderScript: string,
  inputs: Array<{
    name: string;
    buffer: Float32Array;
    size: number;
  }>,
  output: {
    name: string;
    // buffer: Float32Array,
    size: number;
    bufferSize: number;
  }
) {
  const gl = new OffscreenCanvas(0, 0).getContext(
    "webgl2"
  ) as WebGLRenderingContext;

  // compile

  // 取得したソースを使ってシェーダをコンパイルする
  const vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  gl.shaderSource(vertexShader, shaderScript);
  gl.compileShader(vertexShader);
  const vShaderCompileStatus = gl.getShaderParameter(
    vertexShader,
    gl.COMPILE_STATUS
  );
  if (!vShaderCompileStatus) {
    const info = gl.getShaderInfoLog(vertexShader);
    console.log(info);
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
  gl.shaderSource(fragmentShader, dummyFragmentShaderSource);
  gl.compileShader(fragmentShader);

  const fShaderCompileStatus = gl.getShaderParameter(
    fragmentShader,
    gl.COMPILE_STATUS
  );
  if (!fShaderCompileStatus) {
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  // attach and link
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // @ts-ignore
  gl.transformFeedbackVaryings(
    program,
    [output.name],
    // @ts-ignore
    gl.SEPARATE_ATTRIBS
  );
  gl.linkProgram(program);

  const linkStatus = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linkStatus) {
    console.log(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // setup input buffer
  for (const input of inputs) {
    const vecBuffer = gl.createBuffer();
    const vecLocation = gl.getAttribLocation(program, input.name);
    gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
    gl.enableVertexAttribArray(vecLocation);
    gl.vertexAttribPointer(vecLocation, input.size, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, input.buffer, gl.STATIC_DRAW);
  }

  const tfBuffer = gl.createBuffer();
  // @ts-ignore
  const transformFeedback = gl.createTransformFeedback();

  gl.bindBuffer(gl.ARRAY_BUFFER, tfBuffer);
  // @ts-ignore
  // 用途は適当に（今回はDYNAMIC_COPYにしてある）
  gl.bufferData(gl.ARRAY_BUFFER, output.bufferSize, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, null); // バインド解除

  // 一時的にラスタライザを無効化しておく
  // @ts-ignore
  gl.enable(gl.RASTERIZER_DISCARD);

  // それぞれバインドする

  // @ts-ignore
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);

  // @ts-ignore
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfBuffer);

  // 今回は1回だけ実行するので1つだけ点を描画する命令を発行する
  // @ts-ignore
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, 1);

  // フィードバック終わり
  // @ts-ignore
  gl.endTransformFeedback();

  // gl.disable(gl.RASTERIZER_DISCARD);

  const result = new Float32Array(output.size);
  const offset = 0;
  // @ts-ignore
  gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, offset, result);

  // 結果を表示する
  console.log(result);
}

// run
// const gl = new OffscreenCanvas(0, 0).getContext(
//   "webgl2"
// ) as WebGLRenderingContext;
// runGPGPU(gl);

const inputs = [
  { name: "vecA", buffer: new Float32Array([1.0, 2.0, 3.0, 4.0]), size: 4 },
  { name: "vecB", buffer: new Float32Array([5.0, 6.0, 7.0, 8.0]), size: 4 }
];
const output = {
  size: 4,
  bufferSize: Float32Array.BYTES_PER_ELEMENT * 4,
  name: "result"
};

const vertexShaderSource = `#version 300 es
in vec4 vecA;
in vec4 vecB;
out vec4 result;

void main() {
result = vecA + vecB;
}
`;

runGPGPU(vertexShaderSource, inputs, output);
