export class RegularOctahedron {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // 6 vertices of a regular octahedron centered at origin
        const a = 0.3535533905932738;
        this.vertices = new Float32Array([
             0.0,  0.5,  0.0,    // v0: top
             a,    0.0,   a,     // v1
            -a,    0.0,   a,     // v2
            -a,    0.0,  -a,     // v3
             a,    0.0,  -a,     // v4
             0.0, -0.5,  0.0     // v5: bottom
        ]);

        // normals = same directions as the static verts (unit length)
        this.normals = new Float32Array([
             0.0,  1.0,  0.0,
             a,     0.0,  a,
            -a,     0.0,  a,
            -a,     0.0, -a,
             a,     0.0, -a,
             0.0, -1.0,  0.0
        ]);

       // per‐vertex colors (same as before) ...
       if (options.color) {
           this.colors = new Float32Array(6 * 4);
           for (let i = 0; i < 6; ++i) {
               this.colors.set(options.color, i * 4);
           }
       } else {
           this.colors = new Float32Array([
               0.8,0.8,0.8,1.0, 0.8,0.8,0.8,1.0,
               0.8,0.8,0.8,1.0, 0.8,0.8,0.8,1.0,
               0.8,0.8,0.8,1.0, 0.8,0.8,0.8,1.0
           ]);
       }

       // spherical texture coordinates per vertex, flipped vertically
       // const texCoords = new Float32Array(6 * 2);
       // for (let i = 0; i < 6; ++i) {
       //     const x = this.vertices[i*3];
       //     const y = this.vertices[i*3 + 1];
       //     const z = this.vertices[i*3 + 2];
       //     const len = Math.hypot(x, y, z);
       //     const nx = x/len, ny = y/len, nz = z/len;
       //     let u = 0.5 + Math.atan2(nz, nx) / (2 * Math.PI);
       //     let v = 0.5 - Math.asin(ny) / Math.PI;
       //     // flip vertically
       //     v = 1.0 - v;
       //     texCoords[i*2]     = u;
       //     texCoords[i*2 + 1] = v;
       // }
       // this.texCoords = texCoords;
       const texCoords = new Float32Array([
              0.5, 1.0,  // v0: top
              0.0, 0.5,  // v1
              0.25, 0.5,
              0.5, 0.5,  // v2
              0.75, 0.5,
              0.5, 0.0
         ]);
         this.texCoords = texCoords;

       // 8 triangular faces
       this.indices = new Uint16Array([
           0,1,2,  0,2,3,  0,3,4,  0,4,1,
           5,2,1,  5,3,2,  5,4,3,  5,1,4
       ]);

       this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;
        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);

        // allocate and fill VBO
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

        // fill EBO
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        // set attribute pointers
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);

        // enable attributes
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        // unbind
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
}