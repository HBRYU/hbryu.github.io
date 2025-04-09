/*-------------------------------------------------------------------------
08_Transformation.js

canvas의 중심에 한 edge의 길이가 0.3인 정사각형을 그리고, 
이를 크기 변환 (scaling), 회전 (rotation), 이동 (translation) 하는 예제임.
    T는 x, y 방향 모두 +0.5 만큼 translation
    R은 원점을 중심으로 2초당 1회전의 속도로 rotate
    S는 x, y 방향 모두 0.3배로 scale
이라 할 때, 
    keyboard 1은 TRS 순서로 적용
    keyboard 2는 TSR 순서로 적용
    keyboard 3은 RTS 순서로 적용
    keyboard 4는 RST 순서로 적용
    keyboard 5는 STR 순서로 적용
    keyboard 6은 SRT 순서로 적용
    keyboard 7은 원래 위치로 돌아옴
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

let isInitialized = false;
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let axesVAO;
let cubeVAO;
let finalTransform;

let currentTransformType = null;
let isAnimating = true;
let lastTime = 0;
let textOverlay; 

let sunTransform;
let earthTransform;
let moonTransform;

// let sunAngle = 0;
let earthAngle = 0;
let moonAngle = 0;

let sunLocalAngle = 0;
let earthLocalAngle = 0;
let moonLocalAngle = 0;

let sunScaleLength = 0.2;
let earthScaleLength = 0.1;
let moonScaleLength = 0.05;

// let sunRotSpeed = 0.5;
let earthRotSpeed = 1/12.0;
let moonRotSpeed = 1;

let sunLocalRotSpeed = 0.125;
let earthLocalRotSpeed = 0.5;
let moonLocalRotSpeed = 0.5;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    
    return true;
}

function setupAxesBuffers(shader) {
    axesVAO = gl.createVertexArray();
    gl.bindVertexArray(axesVAO);

    const axesVertices = new Float32Array([
        -0.8, 0.0, 0.8, 0.0,  // x축
        0.0, -0.8, 0.0, 0.8   // y축
    ]);

    const axesColors = new Float32Array([
        1.0, 0.3, 0.0, 1.0, 1.0, 0.3, 0.0, 1.0,  // x축 색상
        0.0, 1.0, 0.5, 1.0, 0.0, 1.0, 0.5, 1.0   // y축 색상
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesColors, gl.STATIC_DRAW);
    shader.setAttribPointer("u_color", 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
}

function setupCubeBuffers(shader) {
    const cubeVertices = new Float32Array([
        -0.5,  0.5,  // 좌상단
        -0.5, -0.5,  // 좌하단
         0.5, -0.5,  // 우하단
         0.5,  0.5   // 우상단
    ]);

    const indices = new Uint16Array([
        0, 1, 2,    // 첫 번째 삼각형
        0, 2, 3     // 두 번째 삼각형
    ]);

    const cubeColors = new Float32Array([
        1.0, 0.0, 0.0, 1.0,  // 빨간색
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0
    ]);

    // sunVAO = gl.createVertexArray();
    // gl.bindVertexArray(sunVAO);

    // earthVAO = gl.createVertexArray();      
    // gl.bindVertexArray(earthVAO);

    // moonVAO = gl.createVertexArray();
    // gl.bindVertexArray(moonVAO);

    cubeVAO = gl.createVertexArray();
    gl.bindVertexArray(cubeVAO);


    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeColors, gl.STATIC_DRAW);
    shader.setAttribPointer("u_color", 4, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
}

// function setupKeyboardEvents() {
//     let key;
//     document.addEventListener('keydown', (event) => {
//         key = event.key;
//         switch(key) {
//             case '1': currentTransformType = 'TRS'; isAnimating = true; break;
//             case '2': currentTransformType = 'TSR'; isAnimating = true; break;
//             case '3': currentTransformType = 'RTS'; isAnimating = true; break;
//             case '4': currentTransformType = 'RST'; isAnimating = true; break;
//             case '5': currentTransformType = 'STR'; isAnimating = true; break;
//             case '6': currentTransformType = 'SRT'; isAnimating = true; break;1234
//             case '7':
//                 currentTransformType = null;
//                 isAnimating = false;
//                 rotationAngle = 0;
//                 finalTransform = mat4.create();
//                 break;2
//         }
//         if (currentTransformType) {
//             updateText(textOverlay, event.key + ': ' + currentTransformType);
//         } else {
//             updateText(textOverlay, 'NO TRANSFORMA1TION');
//         }
//     });
// }

function getTransformMatrices() {
    // const T = mat4.create();
    // const R = mat4.create();
    // const S = mat4.create();
    
    // mat4.translate(T, T, [0.5, 0.5, 0]);
    // mat4.rotate(R, R, rotationAngle, [0, 0, 1]);
    // mat4.scale(S, S, [0.3, 0.3, 1]);
    
    // return { T, R, S };

    const sunPos = mat4.create();
    const earthPos = mat4.create();
    const moonPos = mat4.create();

    const sunLocalRot = mat4.create();
    const earthLocalRot = mat4.create();
    const moonLocalRot = mat4.create();

    const sunScale = mat4.create();
    const earthScale = mat4.create();
    const moonScale = mat4.create();

    // mat4.rotate(moonLocalRot, moonLocalRot, moonLocalAngle-moonAngle-earthAngle, [0, 0, 1]);  // Handle rotation offsets
    // mat4.rotate(earthLocalRot, earthLocalRot, earthLocalAngle-earthAngle, [0, 0, 1]);
    mat4.rotate(moonLocalRot, moonLocalRot, moonLocalAngle, [0, 0, 1]);
    mat4.rotate(earthLocalRot, earthLocalRot, earthLocalAngle, [0, 0, 1]);
    mat4.rotate(sunLocalRot, sunLocalRot, sunLocalAngle, [0, 0, 1]);

    mat4.rotate(moonPos, moonPos, earthAngle, [0, 0, 1]);
    mat4.translate(moonPos, moonPos, [0.7, 0, 0]);
    // mat4.rotate(moonPos, moonPos, moonAngle - earthAngle, [0, 0, 1]);
    mat4.rotate(moonPos, moonPos, moonAngle, [0, 0, 1]);
    mat4.translate(moonPos, moonPos, [0.2, 0, 0]);
    
    mat4.rotate(earthPos, earthPos, earthAngle, [0, 0, 1]);
    mat4.translate(earthPos, earthPos, [0.7, 0, 0]);

    mat4.translate(sunPos, sunPos, [0, 0, 0]);  // No change

    mat4.scale(sunScale, sunScale, [sunScaleLength, sunScaleLength, 1]);
    mat4.scale(earthScale, earthScale, [earthScaleLength, earthScaleLength, 1]);
    mat4.scale(moonScale, moonScale, [moonScaleLength, moonScaleLength, 1]);

    return {sunPos, earthPos, moonPos, sunLocalRot, earthLocalRot, moonLocalRot, sunScale, earthScale, moonScale};
}

function applyTransform(type) {
    const {sunPos, earthPos, moonPos, sunLocalRot, earthLocalRot, moonLocalRot, sunScale, earthScale, moonScale} = getTransformMatrices();
    // finalTransform = mat4.create();
    // const { T, R, S } = getTransformMatrices();
    // mat4.multiply(finalTransform, matrix, finalTransform);
    // const transformOrder = {
    //     'TRS': [T, R, S],
    //     'TSR': [T, S, R],
    //     'RTS': [R, T, S],
    //     'RST': [R, S, T],
    //     'STR': [S, T, R],
    //     'SRT': [S, R, T]
    // };

    // /*
    //   array.forEach(...) : array 각 element에 대해 반복
    // */
    // if (transformOrder[type]) {
    //     transformOrder[type].forEach(matrix => {
    //         mat4.multiply(finalTransform, matrix, finalTransform);
    //     });
    // }

    moonTransform = mat4.create();
    earthTransform = mat4.create();
    sunTransform = mat4.create();

    mat4.multiply(moonTransform, moonScale, moonTransform);
    mat4.multiply(moonTransform, moonLocalRot, moonTransform);
    mat4.multiply(moonTransform, moonPos, moonTransform);  // Applying position transformation would also apply global rotation

    mat4.multiply(earthTransform, earthScale, earthTransform);
    mat4.multiply(earthTransform, earthLocalRot, earthTransform);
    mat4.multiply(earthTransform, earthPos, earthTransform);

    mat4.multiply(sunTransform, sunScale, sunTransform);
    mat4.multiply(sunTransform, sunLocalRot, sunTransform);
    mat4.multiply(sunTransform, sunPos, sunTransform);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();

    // 축 그리기
    shader.setMat4("u_model", mat4.create());
    gl.bindVertexArray(axesVAO);
    gl.drawArrays(gl.LINES, 0, 4);
    gl.bindVertexArray(null);

    // 정사각형 그리기
    // shader.setMat4("u_transform", finalTransform);
    // gl.bindVertexArray(cubeVAO);
    // gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(cubeVAO);

    // 태양 - red
    shader.setMat4("u_model", sunTransform);
    shader.setVec4("u_color", [1.0, 0.0, 0.0, 1.0]);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // 지구 - syan
    shader.setMat4("u_model", earthTransform);
    shader.setVec4("u_color", [0.0, 1.0, 1.0, 1.0]);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // 달 - yellow
    shader.setMat4("u_model", moonTransform);
    shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function animate(currentTime) {
    console.log(currentTransformType);
    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (isAnimating) {
        // rotationAngle += Math.PI * 0.5* deltaTime;
        earthAngle +=  earthRotSpeed * Math.PI * 2 * deltaTime;
        moonAngle += moonRotSpeed * Math.PI * 2 * deltaTime;
        sunLocalAngle += sunLocalRotSpeed * Math.PI * 2 * deltaTime;
        earthLocalAngle += earthLocalRotSpeed * Math.PI * 2 * deltaTime;
        moonLocalAngle += moonLocalRotSpeed * Math.PI * 2 * deltaTime;

        applyTransform(currentTransformType);
    }
    render();
    requestAnimationFrame(animate);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    return new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        // finalTransform = mat4.create();
        
        sunTransform = mat4.create(); 
        earthTransform = mat4.create();
        moonTransform = mat4.create();

        shader = await initShader();
        setupAxesBuffers(shader);
        setupCubeBuffers(shader);
        // textOverlay = setupText(canvas, 'Solar System Simulation', 1);
        // setupKeyboardEvents();
        shader.use();
        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
