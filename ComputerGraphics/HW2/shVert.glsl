#version 300 es

layout (location = 0) in vec3 aPos;

uniform float xPos;
uniform float yPos;

void main() {
    gl_Position = vec4(aPos[0] + xPos, aPos[1] + yPos, aPos[2], 1.0);
} 