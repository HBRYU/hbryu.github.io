export class SquarePyramid {
    constructor(gl, shader) {
        this.gl = gl;
        this.shader = shader;
        this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;

        const vertices = new Float32Array([
            // Bottom face (gray)
            -0.5, 0.0, -0.5, 0.5, 0.5, 0.5,
             0.5, 0.0, -0.5, 0.5, 0.5, 0.5,
             0.5, 0.0,  0.5, 0.5, 0.5, 0.5,
            -0.5, 0.0, -0.5, 0.5, 0.5, 0.5,
             0.5, 0.0,  0.5, 0.5, 0.5, 0.5,
            -0.5, 0.0,  0.5, 0.5, 0.5, 0.5,

            // Back (red)
            -0.5, 0.0, -0.5, 1.0, 0.0, 0.0,
             0.5, 0.0, -0.5, 1.0, 0.0, 0.0,
             0.0, 1.0,  0.0, 1.0, 0.0, 0.0,

            // Right (green)
             0.5, 0.0, -0.5, 0.0, 1.0, 1.0,
             0.5, 0.0,  0.5, 0.0, 1.0, 1.0,
             0.0, 1.0,  0.0, 0.0, 1.0, 1.0,

            // Front (blue)
             0.5, 0.0,  0.5, 1.0, 0.0, 1.0,
            -0.5, 0.0,  0.5, 1.0, 0.0, 1.0,
             0.0, 1.0,  0.0, 1.0, 0.0, 1.0,

            // Left (yellow)
            -0.5, 0.0,  0.5, 1.0, 1.0, 0.0,
            -0.5, 0.0, -0.5, 1.0, 1.0, 0.0,
             0.0, 1.0,  0.0, 1.0, 1.0, 0.0
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.vertexCount = vertices.length / 6;
    }

    draw() {
        const gl = this.gl;
        const shader = this.shader;
        const stride = 6 * Float32Array.BYTES_PER_ELEMENT;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        const posLoc = gl.getAttribLocation(shader.program, 'a_position');
        const colorLoc = gl.getAttribLocation(shader.program, 'a_color');

        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, stride, 3 * 4);

        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
}
