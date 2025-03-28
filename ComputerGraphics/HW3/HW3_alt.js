/*-------------------------------------------------------------------------
07_LineSegments.js

left mouse button을 click하면 선분을 그리기 시작하고, 
button up을 하지 않은 상태로 마우스를 움직이면 임시 선분을 그리고, 
button up을 하면 최종 선분을 저장하고 임시 선분을 삭제함.

임시 선분의 color는 회색이고, 최종 선분의 color는 빨간색임.

이 과정을 반복하여 여러 개의 선분 (line segment)을 그릴 수 있음. 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';


// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let isDrawing = false; // mouse button을 누르고 있는 동안 true로 change
let startPoint = null;  // mouse button을 누른 위치
let tempEndPoint = null; // mouse를 움직이는 동안의 위치
let lines = []; // 그려진 선분들을 저장하는 array
let textOverlay; // 1st line segment 정보 표시
let textOverlay2; // 2nd line segment 정보 표시
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

// Global variables 수정
let circle = null;
let line = null;
let intersectionPoints = [];
let mode = 'circle'; // 'circle' 또는 'line' 모드
let textOverlay3; // 교차점 정보를 위한 세 번째 텍스트 오버레이 추가
let center = (0,0);


// DOMContentLoaded event
// 1) 모든 HTML 문서가 완전히 load되고 parsing된 후 발생
// 2) 모든 resource (images, css, js 등) 가 완전히 load된 후 발생
// 3) 모든 DOM 요소가 생성된 후 발생
// DOM: Document Object Model로 HTML의 tree 구조로 표현되는 object model 
// 모든 code를 이 listener 안에 넣는 것은 mouse click event를 원활하게 처리하기 위해서임
// mouse input을 사용할 때 이와 같이 main을 call 한다. 

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
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
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}


// 교차점 관련 함수 추가
function calculateCircleIntersections(line, circle) {
    const [x1, y1, x2, y2] = line;
    const [cx, cy, radius] = circle;

    // 선분과 원의 교차점 계산 (해석적 방법)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const A = dx * dx + dy * dy;
    const B = 2 * (dx * (x1 - cx) + dy * (y1 - cy));
    const C = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy) - radius * radius;

    const discriminant = B * B - 4 * A * C;
    
    if (discriminant < 0) {
        // 교차점 없음
        return [];
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t1 = (-B + sqrtDiscriminant) / (2 * A);
    const t2 = (-B - sqrtDiscriminant) / (2 * A);

    const intersections = [];

    if (t1 >= 0 && t1 <= 1) {
        const ix1 = x1 + t1 * dx;
        const iy1 = y1 + t1 * dy;
        intersections.push([ix1, iy1]);
    }

    if (t2 >= 0 && t2 <= 1) {
        const ix2 = x1 + t2 * dx;
        const iy2 = y1 + t2 * dy;
        intersections.push([ix2, iy2]);
    }

    return intersections;
}

/* 
    browser window
    +----------------------------------------+
    | toolbar, address bar, etc.             |
    +----------------------------------------+
    | browser viewport (컨텐츠 표시 영역)       | 
    | +------------------------------------+ |
    | |                                    | |
    | |    canvas                          | |
    | |    +----------------+              | |
    | |    |                |              | |
    | |    |      *         |              | |
    | |    |                |              | |
    | |    +----------------+              | |
    | |                                    | |
    | +------------------------------------+ |
    +----------------------------------------+

    *: mouse click position

    event.clientX = browser viewport 왼쪽 경계에서 마우스 클릭 위치까지의 거리
    event.clientY = browser viewport 상단 경계에서 마우스 클릭 위치까지의 거리
    rect.left = browser viewport 왼쪽 경계에서 canvas 왼쪽 경계까지의 거리
    rect.top = browser viewport 상단 경계에서 canvas 상단 경계까지의 거리

    x = event.clientX - rect.left  // canvas 내에서의 클릭 x 좌표
    y = event.clientY - rect.top   // canvas 내에서의 클릭 y 좌표
*/

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        
        let [glX, glY] = convertToWebGLCoordinates(x, y);
        
        if (mode === 'circle' && !circle) {
                    // 원의 중심점 설정
            center = [glX, glY];
            isDrawing = true;
            updateText(textOverlay, `Circle center: (${glX.toFixed(2)}, ${glY.toFixed(2)})`);
            updateText(textOverlay2, "Drag to set circle radius");
        } else if (mode === 'line' && !line) {
            // 기존 선분 그리기 로직
            startPoint = [glX, glY];
            isDrawing = true;
        }
    }

    function handleMouseMove(event) {
        if (isDrawing && mode === 'circle' && center) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            
            // 반지름 계산 (중심점에서 현재 마우스 위치까지의 거리)
            const radius = Math.sqrt(
                Math.pow(glX - center[0], 2) + 
                Math.pow(glY - center[1], 2)
            );
            
            circle = [center[0], center[1], radius];
            
            render();
        } else if (isDrawing && mode === 'line') {
            // 기존 선분 그리기 로직
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            tempEndPoint = [glX, glY];
            render();
        }
    }

    function handleMouseUp() {
        if (isDrawing && mode === 'circle' && circle) {
            // 원 그리기 완료
            mode = 'line';
            isDrawing = false;
            updateText(textOverlay2, "Draw line segment");
        } else if (isDrawing && mode === 'line' && tempEndPoint) {
            // 선분 그리기 로직 (기존과 동일)
            line = [...startPoint, ...tempEndPoint];
            
            updateText(textOverlay2, `Line segment: (${line[0].toFixed(2)}, ${line[1].toFixed(2)}) ~ (${line[2].toFixed(2)}, ${line[3].toFixed(2)})`);
            
            intersectionPoints = calculateCircleIntersections(line, circle);
            
            if (intersectionPoints.length > 0) {
                let intersectionInfo = `Intersections: ${intersectionPoints.length}\n`;
                intersectionPoints.forEach((point, index) => {
                    intersectionInfo += `Point ${index + 1}: (${point[0].toFixed(2)}, ${point[1].toFixed(2)})\n`;
                });
                updateText(textOverlay3, intersectionInfo);
            } else {
                updateText(textOverlay3, "No intersections");
            }

            isDrawing = false;
            startPoint = null;
            tempEndPoint = null;
        }
        
        render();
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}


function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.use();

    // 원 그리기
    if (circle) {
        let [cx, cy, radius] = circle;
        let numSegments = 100;
        let angle = 2 * Math.PI / numSegments;

        let vertices = [];
        for (let i = 0; i < numSegments; i++) {
            let x1 = cx + radius * Math.cos(i * angle);
            let y1 = cy + radius * Math.sin(i * angle);
            let x2 = cx + radius * Math.cos((i + 1) * angle);
            let y2 = cy + radius * Math.sin((i + 1) * angle);
            vertices.push(x1, y1, x2, y2);
        }

        let vertexArray = new Float32Array(vertices);

        shader.setVec4("u_color", isDrawing ? [0.7, 0.7, 0.7, 1.0] : [0.0, 1.0, 0.0, 1.0]);

        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, vertexArray.length / 2);
    }

    // 저장된 선들 그리기
    if (line) {
        shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]); 
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 임시 선 그리기
    if (isDrawing && startPoint && tempEndPoint) {
        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 교차점 그리기
    if (intersectionPoints.length > 0) {
        shader.setVec4("u_color", [1.0, 0.0, 0.0, 1.0]); // 빨간색 점
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intersectionPoints.flat()), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, intersectionPoints.length);
    }


    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        textOverlay = setupText(canvas, "No line segment", 1);
        textOverlay2 = setupText(canvas, "Click mouse button and drag to draw line segments", 2);
        textOverlay3 = setupText(canvas, "Waiting for input", 3);

        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
