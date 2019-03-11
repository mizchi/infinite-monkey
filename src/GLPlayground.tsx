import React from "react";

export function GPGPUPlayground() {
  return <div>foo</div>;
}

declare var OffscreenCanvas: any;

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
    dim: number;
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
  ) as WebGL2RenderingContext;

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

  gl.transformFeedbackVaryings(program, [output.name], gl.SEPARATE_ATTRIBS);
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
    gl.vertexAttribPointer(vecLocation, input.dim, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, input.buffer, gl.STATIC_DRAW);
  }

  const tfBuffer = gl.createBuffer();
  const transformFeedback = gl.createTransformFeedback();

  gl.bindBuffer(gl.ARRAY_BUFFER, tfBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, output.bufferSize, gl.DYNAMIC_COPY);

  gl.bindBuffer(gl.ARRAY_BUFFER, null); // バインド解除

  // 一時的にラスタライザを無効化しておく
  gl.enable(gl.RASTERIZER_DISCARD);

  // それぞれバインドする
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);

  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfBuffer);

  // 今回は1回だけ実行するので1つだけ点を描画する命令を発行する
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, 2);
  // gl.drawArrays(gl.POINTS, 0, 1);

  // フィードバック終わり
  gl.endTransformFeedback();
  gl.readBuffer;
  // gl.readPixels()

  const result = new Float32Array(output.size);
  const offset = 0;
  gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, offset, result);

  // 結果を表示する
  console.log(result);
}

function checkError(gl: WebGL2RenderingContext) {
  while (true) {
    const e = gl.getError();
    switch (e) {
      case gl.INVALID_ENUM: {
        console.log("invalid");
        break;
      }
      case gl.NO_ERROR: {
        console.log("no error");
        break;
      }
      default: {
        console.log("enum", e);
        break;
      }
    }
  }
}

// run

const inputs = [
  {
    name: "vecA",
    buffer: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]),
    dim: 4
  },
  {
    name: "vecB",
    buffer: new Float32Array([5, 6, 7, 8, 9, 10, 11, 12]),
    dim: 4
  }
];

const output = {
  size: 8,
  bufferSize: Float32Array.BYTES_PER_ELEMENT * 8,
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
