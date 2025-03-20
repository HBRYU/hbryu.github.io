/*-------------------------------------------------------------------------
06_FlipTriangle.js

1) Change the color of the triangle by keyboard input
   : 'r' for red, 'g' for green, 'b' for blue
2) Flip the triangle vertically by keyboard input 'f' 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let vao;
let colorTag = "red";
let xPos = 0.0;
let yPos = 0.0;
let textOverlay3; // for text output third line (see util.js)

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 600;
    canvas.height = 600;

    resizeAspectRatio(gl, canvas);

    // Initialize WebGL settings
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    return new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function setupKeyboardEvents() {
    document.addEventListener('keydown', (event) => {
        if (event.key == 'ArrowUp' && yPos < 0.9) {
            yPos += 0.01;
        }
        if (event.key == 'ArrowDown' && yPos > -0.9) {
            yPos -= 0.01;
        }
        if (event.key == 'ArrowRight' && xPos < 0.9) {
            xPos += 0.01;
        }
        if (event.key == 'ArrowLeft' && xPos > -0.9) {
            xPos -= 0.01;
        }
    });
}

function setupBuffers(shader) {
    const vertices = new Float32Array([
        -0.1, -0.1, 0.0,  // Bottom left
        0.1, -0.1, 0.0,  // Bottom right
        0.1,  0.1, 0.0,   // Top right
        -0.1,  0.1, 0.0  // Top left
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    shader.setAttribPointer('aPos', 3, gl.FLOAT, false, 0, 0);

    return vao;
}

function render(vao, shader) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    let color;
    if (colorTag == "red") {
        color = [1.0, 0.0, 0.0, 1.0];
    }
    else if (colorTag == "green") {
        color = [0.0, 1.0, 0.0, 1.0];
    }
    else if (colorTag == "blue") {
        color = [0.0, 0.0, 1.0, 1.0];
    }

    shader.setVec4("uColor", color);
    shader.setFloat("xPos", xPos);
    shader.setFloat("yPos", yPos);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    requestAnimationFrame(() => render(vao, shader));
}

async function main() {
    try {

        // WebGL 초기화
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        // 셰이더 초기화
        shader = await initShader();

        // setup text overlay (see util.js)
        setupText(canvas, "Use arrow keys to move the rectangle", 1);

        // 키보드 이벤트 설정
        setupKeyboardEvents();
        
        // 나머지 초기화
        vao = setupBuffers(shader);
        shader.use();
        
        // 렌더링 시작
        render(vao, shader);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}

// call main function
main().then(success => {
    if (!success) {
        console.log('프로그램을 종료합니다.');
        return;
    }
}).catch(error => {
    console.error('프로그램 실행 중 오류 발생:', error);
});
