// canvasを作ってDOMに追加する
const canvas = document.createElement("canvas");
canvas.width = 500;
canvas.height = 500;
document.body.appendChild(canvas);

// WebGL2のコンテキストを取得する
const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;

const updaterVertexShaderSource: string = `#version 300 es
uniform vec2 origin;
uniform float elapsedTimeDelta;

in vec2 particlePosition;
in vec2 particleVelocity;
in float particleAge;
in float particleLife;

//
// 書き出す変数
// TransformFeedbackバッファから利用できる
//
out vec2 vertexPosition;
out vec2 vertexVelocity;
out float vertexAge;
out float vertexLife;

//
// メイン処理
//
void main() {
  if(particleAge > particleLife) {
    // 寿命を超えたら元の場所に戻す
    vertexPosition = origin;
    vertexVelocity = particleVelocity;
    vertexAge = 0.0;
    vertexLife = particleLife;
  } else {
    // 超えてなければ更新する
    vertexPosition = particlePosition + (particleVelocity * elapsedTimeDelta);
    vertexVelocity = particleVelocity;
    vertexAge = particleAge + elapsedTimeDelta;
    vertexLife = particleLife;
  }
}
`;

const updaterFragmentShaderSource = `#version 300 es
precision highp float;

void main() {
  discard;
}
`;

const rendererVertexShaderSource = `#version 300 es
in vec2 particlePosition;

void main() {
  gl_PointSize = 2.0;
  gl_Position = vec4(particlePosition, 0.0, 1.0);
}
`;

const rendererFragmentShaderSource = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
  fragColor = vec4(1.0); // 白色
}
`;

// プログラムをリンクして返す関数
function createProgram(
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
  program: WebGLProgram,
  buffer: WebGLBuffer,
  attributes: Array<{
    name: string;
    size: number;
    type: number;
    byteSize: number;
  }>,
  stride: number,
  data: Float32Array | null = null,
  usage: any = gl.STATIC_DRAW
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

// メイン関数
(function main() {
  const PARTICLE_NUM = 1000; // パーティクルの数
  const MAX_SPEED = 0.001; // パーティクルの最大速度
  const MAX_LIFE = 1000.0; // パーティクルの最大寿命
  const originPoint = new Float32Array([0.0, 0.0]); // 原点

  // マウスポインタの場所をパーティクル発生の原点にする
  canvas.addEventListener("mousemove", mEvent => {
    originPoint[0] = -1.0 + (mEvent.clientX / canvas.width) * 2;
    originPoint[1] = 1.0 - (mEvent.clientY / canvas.height) * 2;
  });

  // 書き戻す変数
  const feedbackVariables = [
    "vertexPosition",
    "vertexVelocity",
    "vertexAge",
    "vertexLife"
  ];

  // Update用のプログラムとRender用のプログラムを作成する
  const updaterProgram = createProgram(
    updaterVertexShaderSource,
    updaterFragmentShaderSource,
    feedbackVariables
  );
  const rendererProgram = createProgram(
    rendererVertexShaderSource,
    rendererFragmentShaderSource
  );

  // バッファの初期化時に黒で初期化するようにする
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // パーティクルの初期データを用意する
  const particleInitialData = [];
  for (let i = 0; i < PARTICLE_NUM; i++) {
    // 初期xy座標
    particleInitialData.push(originPoint[0]);
    particleInitialData.push(originPoint[1]);

    // 速度（-MAX_SPEEDから+MAX_SPEEDまでの間）
    const vx = -MAX_SPEED + Math.random() * (MAX_SPEED * 2);
    const vy = -MAX_SPEED + Math.random() * (MAX_SPEED * 2);
    particleInitialData.push(vx);
    particleInitialData.push(vy);

    // 年齢
    particleInitialData.push(0.0);

    // 寿命
    const life = Math.random() * MAX_LIFE;
    particleInitialData.push(life);
  }

  const particleInitialDataF32 = new Float32Array(particleInitialData);

  // 各VAOを作成する
  // [input, output] * [Update, Render] の計4つ

  // 入力用のバッファと出力用のバッファ
  const inputBuffer = gl.createBuffer() as WebGLBuffer;
  const outputBuffer = gl.createBuffer() as WebGLBuffer;

  const updaterAttributes: Array<{
    name: string;
    size: number;
    type: number;
    byteSize: number;
  }> = [
    {
      name: "particlePosition",
      size: 2,
      type: gl.FLOAT,
      byteSize: 2 * Float32Array.BYTES_PER_ELEMENT
    },
    {
      name: "particleVelocity",
      size: 2,
      type: gl.FLOAT,
      byteSize: 2 * Float32Array.BYTES_PER_ELEMENT
    },
    {
      name: "particleAge",
      size: 1,
      type: gl.FLOAT,
      byteSize: 1 * Float32Array.BYTES_PER_ELEMENT
    },
    {
      name: "particleLife",
      size: 1,
      type: gl.FLOAT,
      byteSize: 1 * Float32Array.BYTES_PER_ELEMENT
    }
  ];
  const rendererAttributes = [
    {
      name: "particlePosition",
      size: 2,
      type: gl.FLOAT,
      byteSize: 2 * Float32Array.BYTES_PER_ELEMENT
    }
  ];

  const STRIDE = updaterAttributes.reduce(
    (prev, current) => prev + current.byteSize,
    0
  );

  // input - Update
  const inputBufferUpdateVAO = createVAO(
    updaterProgram,
    inputBuffer,
    updaterAttributes,
    STRIDE,
    particleInitialDataF32,
    gl.DYNAMIC_COPY
  );

  // output - Update
  const outputBufferUpdateVAO = createVAO(
    updaterProgram,
    outputBuffer,
    updaterAttributes,
    STRIDE,
    particleInitialDataF32,
    gl.DYNAMIC_COPY
  );

  // input - Render
  const inputBufferRenderVAO = createVAO(
    rendererProgram,
    inputBuffer,
    rendererAttributes,
    STRIDE
  );

  // output - Render
  const outputBufferRenderVAO = createVAO(
    rendererProgram,
    outputBuffer,
    rendererAttributes,
    STRIDE
  );

  // フィードバックを作成する
  const transformFeedback = gl.createTransformFeedback();
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);

  const buffers = [inputBuffer, outputBuffer];
  const updateVAOs = [inputBufferUpdateVAO, outputBufferUpdateVAO];
  const renderVAOs = [inputBufferRenderVAO, outputBufferRenderVAO];
  let inputIndex = 0;
  let outputIndex = 1;

  // ループを開始する
  let prevTimeMs = performance.now(); // 前回処理したときの時間（ミリ秒）
  function loop(timestampMs: number) {
    // 前回からの経過時間を計算する
    const elapsedTime = timestampMs - prevTimeMs;

    // カラーバッファをクリアする
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 計算用のプログラムを使用する
    gl.useProgram(updaterProgram);

    // uniform変数をセットする
    gl.uniform2fv(gl.getUniformLocation(updaterProgram, "origin"), originPoint);
    gl.uniform1f(
      gl.getUniformLocation(updaterProgram, "elapsedTimeDelta"),
      elapsedTime
    );

    // ラスタライザを無効化
    gl.enable(gl.RASTERIZER_DISCARD);

    // 計算してフィードバックする
    // gl.bindVertexArray(updateVAOs[inputIndex]);
    gl.bindVertexArray(updateVAOs[inputIndex]);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffers[outputIndex]);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_NUM); // PARTICLE_NUM個の計算をする

    gl.endTransformFeedback();

    // バインド解除
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

    // ラスタライザの再有効化
    gl.disable(gl.RASTERIZER_DISCARD);

    // 描画用のプログラムを使用する
    gl.useProgram(rendererProgram);
    gl.bindVertexArray(renderVAOs[outputIndex]);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_NUM);

    // swap
    [inputIndex, outputIndex] = [outputIndex, inputIndex];

    // 繰り返す
    prevTimeMs = timestampMs;
    requestAnimationFrame(ts => loop(ts));
  }

  // ループ開始
  requestAnimationFrame(ts => loop(ts));
})();
