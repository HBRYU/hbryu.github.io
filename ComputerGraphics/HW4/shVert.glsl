#version 300 es

in vec3 a_position;
uniform vec4 u_color;
uniform mat4 u_model;
out vec4 v_color;

void main() {
    gl_Position = u_model * vec4(a_position, 1.0);
    v_color = u_color;
} 