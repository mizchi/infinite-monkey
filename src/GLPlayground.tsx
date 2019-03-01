declare var OffscreenCanvas: any;
// import "./glsl3";
import { range, flatten } from "lodash";

import React, { useEffect } from "react";

type InputAttribute = {
  name: string;
  size: number;
  type: number;
  byteSize: number;
  data: Float32Array;
};

type OutputAttribute = {
  name: string;
  size: number;
  byteSize: number;
};

export function GPGPUPlayground() {
  useEffect(() => {
    const gl = new OffscreenCanvas(0, 0).getContext(
      "webgl2"
    ) as WebGL2RenderingContext;

    const inputs: InputAttribute[] = [
      {
        name: "vecA",
        type: gl.FLOAT,
        data: new Float32Array([1.0, 2.0, 3.0, 4.0]),
        size: 4,
        byteSize: Float32Array.BYTES_PER_ELEMENT * 4
      },
      {
        name: "vecB",
        type: gl.FLOAT,
        data: new Float32Array([5.0, 6.0, 7.0, 8.0]),
        size: 4,
        byteSize: Float32Array.BYTES_PER_ELEMENT * 4
      }
    ];
    const output: OutputAttribute = {
      size: 4,
      byteSize: Float32Array.BYTES_PER_ELEMENT * 4,
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
void main() {
  discard;
}
`;

const INPUT_NUM = 10;

function runGPGPU(
  shaderScript: string,
  inputs: Array<InputAttribute>,
  output: OutputAttribute
) {
  const gl = new OffscreenCanvas(0, 0).getContext(
    "webgl2"
  ) as WebGL2RenderingContext;
  gl.enable(gl.RASTERIZER_DISCARD);

  const program = createProgram(gl, shaderScript, dummyFragmentShaderSource, [
    "result"
  ]);

  gl.useProgram(program);

  for (const input of inputs) {
    const vecBuffer = gl.createBuffer();
    const vecLocation = gl.getAttribLocation(program, input.name);
    gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
    gl.enableVertexAttribArray(vecLocation);
    gl.vertexAttribPointer(vecLocation, input.size, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, input.data, gl.STATIC_DRAW);
  }

  const inputBuffer = gl.createBuffer() as WebGLBuffer;
  const outputBuffer = gl.createBuffer() as WebGLBuffer;

  const STRIDE = inputs.reduce((prev, current) => prev + current.byteSize, 0);
  const initialData = new Float32Array(
    flatten(range(INPUT_NUM).map(n => [0.0, 1.0, 2.0, 3.0]))
  );

  const inputVao = createVAO(
    gl,
    program,
    inputBuffer,
    inputs,
    STRIDE,
    initialData,
    gl.DYNAMIC_COPY
  );

  // gl.bindVertexArray(inputVao);
  // gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outputBuffer);
  // gl.beginTransformFeedback(gl.POINTS);
  // gl.drawArrays(gl.POINTS, 0, INPUT_NUM); // PARTICLE_NUM個の計算をする
  // gl.endTransformFeedback();
  // gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, outputBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, output.byteSize, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, null); // バインド解除

  const transformFeedback = gl.createTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outputBuffer);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, 1);
  gl.endTransformFeedback();

  const result = new Float32Array(output.size);
  const offset = 0;
  // @ts-ignore
  gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, offset, result);

  // 結果を表示する
  console.log(result);
}

// プログラムをリンクして返す関数
function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
  feedbackVariables: string[] = []
) {
  // シェーダをコンパイルする
  const vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  gl.shaderSource(vertexShader, vsSource);
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
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  const fShaderCompileStatus = gl.getShaderParameter(
    fragmentShader,
    gl.COMPILE_STATUS
  );
  if (!fShaderCompileStatus) {
    const info = gl.getShaderInfoLog(fragmentShader);
    console.log(info);
  }

  // シェーダプログラムの作成
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  // 書き出す変数
  if (feedbackVariables.length !== 0) {
    gl.transformFeedbackVaryings(
      program,
      feedbackVariables,
      gl.INTERLEAVED_ATTRIBS
    );
  }

  gl.linkProgram(program);

  // リンクできたかどうかを確認
  const linkStatus = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linkStatus) {
    const info = gl.getProgramInfoLog(program);
    console.log(info);
  }

  return program;
}

// Vertex Array Objectを作成する関数
function createVAO(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  buffer: WebGLBuffer,
  attributes: Array<InputAttribute>,
  stride: number,
  data: Float32Array | null = null,
  usage = gl.STATIC_DRAW
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  let offset = 0;
  for (const attr of attributes) {
    const attrLocation = gl.getAttribLocation(program, attr.name);
    gl.enableVertexAttribArray(attrLocation);
    gl.vertexAttribPointer(
      attrLocation,
      attr.size,
      attr.type,
      false,
      stride,
      offset
    );
    offset += attr.byteSize;
  }

  if (data !== null) {
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  }

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return vao as WebGLVertexArrayObject;
}

// --- run ---

// const inputs = [
//   { name: "vecA", buffer: new Float32Array([1.0, 2.0, 3.0, 4.0]), size: 4 },
//   { name: "vecB", buffer: new Float32Array([5.0, 6.0, 7.0, 8.0]), size: 4 }
// ];
// const output = {
//   size: 4,
//   bufferSize: Float32Array.BYTES_PER_ELEMENT * 4,
//   name: "result"
// };

// const vertexShaderSource = `#version 300 es
// in vec4 vecA;
// in vec4 vecB;
// out vec4 result;

// void main() {
// result = vecA + vecB;
// }
// `;

// runGPGPU(vertexShaderSource, inputs, output);
