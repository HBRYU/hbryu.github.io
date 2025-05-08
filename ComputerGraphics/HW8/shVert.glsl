#version 300 es
precision mediump float;

in vec3 aPos;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 FragPos;
out vec3 Normal;
out vec2 TexCoord;

void main() {
    FragPos = vec3(u_model * vec4(aPos, 1.0));
    Normal = mat3(transpose(inverse(u_model))) * aNormal;
    TexCoord = aTexCoord;
    
    gl_Position = u_projection * u_view * u_model * vec4(aPos, 1.0);
}