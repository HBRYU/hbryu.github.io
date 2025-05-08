#version 300 es
precision mediump float;

struct Material {
    sampler2D diffuse;
    vec3 specular;
    float shininess;
};

struct DirectionalLight {
    vec3 direction;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

in vec3 FragPos;
in vec3 Normal;
in vec2 TexCoord;

uniform vec3 u_viewPos;
uniform DirectionalLight light;
uniform Material material;
uniform int u_toonLevels;

out vec4 FragColor;

// Quantize value to discrete steps based on toon levels
float quantize(float value, int levels) {
    float step = 1.0 / float(levels);
    return floor(value / step) * step + step * 0.5;
}

void main() {
    // Normalize vectors
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(-light.direction);
    float dotNormLight = dot(norm, lightDir);
    
    // Ambient
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoord));
    
    // Diffuse
    float diff = max(dot(norm, lightDir), 0.0);
    // Quantize diffuse
    diff = quantize(diff, u_toonLevels);
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoord));
    
    // Specular
    vec3 viewDir = normalize(u_viewPos - FragPos);
    vec3 reflectDir = reflect(lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // Quantize specular
    spec = quantize(spec, u_toonLevels);
    
    if(dotNormLight < 0.0)
    {
        spec = 0.0;
    }
    
    vec3 specular = light.specular * spec * material.specular;
    
    // Combine
    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}