// Global constants
const canvas = document.getElementById('glCanvas'); // Get the canvas element 
const gl = canvas.getContext('webgl2'); // Get the WebGL2 context

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

// Set canvas size: 현재 window 전체를 canvas로 사용
canvas.width = 500;
canvas.height = 500;

// Enable scissor test
gl.enable(gl.SCISSOR_TEST);

// Render loop
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    let w = canvas.width / 2;
    let h = canvas.height / 2;

    // Top-Left (Red)
    gl.viewport(0, h, w, h);
    gl.scissor(0, h, w, h);
    gl.clearColor(1, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Top-Right (Green)
    gl.viewport(w, h, w, h);
    gl.scissor(w, h, w, h);
    gl.clearColor(0, 1, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-Left (Blue)
    gl.viewport(0, 0, w, h);
    gl.scissor(0, 0, w, h);
    gl.clearColor(0, 0, 1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-Right (Yellow)
    gl.viewport(w, 0, w, h);
    gl.scissor(w, 0, w, h);
    gl.clearColor(1, 1, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

// Initial rendering
render();

// Resize viewport when window size changes
window.addEventListener('resize', () => {
    let min = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = min;
    canvas.height = min;
    render();
});
