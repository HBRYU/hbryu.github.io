import * as THREE from 'https://unpkg.com/three@0.149.0/build/three.module.js'; // Specific version
import { EffectComposer } from 'https://unpkg.com/three@0.149.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.149.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.149.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.149.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Create and configure the post-processing composer
export function createPostProcessing(scene, camera, renderer) {
    // Set renderer to use nearest neighbor filtering for sharper pixels
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.textureEncoding = THREE.LinearEncoding;
    
    // Force textures to use nearest neighbor filtering
    THREE.TextureLoader.prototype.load = function() {
        const originalLoad = THREE.TextureLoader.prototype.load;
        return function(url, onLoad, onProgress, onError) {
            return originalLoad.call(this, url, function(texture) {
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                if (onLoad) onLoad(texture);
            }, onProgress, onError);
        };
    }();
    
    // Create composer with the same size as renderer
    const composer = new EffectComposer(renderer);
    
    // Configure render target for no filtering
    composer.renderTarget1.texture.minFilter = THREE.NearestFilter;
    composer.renderTarget1.texture.magFilter = THREE.NearestFilter;
    composer.renderTarget2.texture.minFilter = THREE.NearestFilter;
    composer.renderTarget2.texture.magFilter = THREE.NearestFilter;
    
    // Just add the basic render pass - no special effects
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Custom shader for color adjustment
    const colorShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "brightness": { value: 1.1 },
            "contrast": { value: 1.1 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float brightness;
            uniform float contrast;
            varying vec2 vUv;
            
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                color.rgb *= brightness;
                gl_FragColor = color;
            }
        `
    };
    
    const colorPass = new ShaderPass(colorShader);
    composer.addPass(colorPass);    // Add toon shader pass
    const toonShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "numLevels": { value: 16.0 },
            "edgeThickness": { value: 0.0 },
            "edgeColor": { value: new THREE.Color(0x000000) },
            "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `            uniform sampler2D tDiffuse;
            uniform float numLevels;
            uniform float edgeThickness;
            uniform vec3 edgeColor;
            uniform vec2 resolution;
            varying vec2 vUv;
            
            void main() {
                // Sample the texture
                vec4 texel = texture2D(tDiffuse, vUv);
                
                // Calculate luminance
                float luminance = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
                  // Quantize to get toon shading
                float level = floor(luminance * numLevels) / numLevels;
                
                // Edge detection using basic sobel with resolution uniform
                vec2 texelSize = vec2(1.0) / resolution;
                float dx = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0)).r - 
                          texture2D(tDiffuse, vUv - vec2(texelSize.x, 0.0)).r;
                float dy = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y)).r - 
                          texture2D(tDiffuse, vUv - vec2(0.0, texelSize.y)).r;
                          
                // Calculate edge factor
                float edge = length(vec2(dx, dy)) * edgeThickness;
                
                // Preserve original hue and saturation while quantizing brightness
                float brightness = luminance;
                vec3 color = texel.rgb / max(brightness, 0.001); // Get color without brightness
                vec3 toonColor = color * (level); // Apply quantized brightness
                
                // Mix toon shading with edge detection
                toonColor = mix(toonColor, edgeColor, min(edge, 1.0));
                
                gl_FragColor = vec4(toonColor, texel.a);
            }
        `
    };    const toonPass = new ShaderPass(toonShader);
    composer.addPass(toonPass);
    
    // Update toon shader resolution on window resize
    window.addEventListener('resize', () => {
        toonPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });
    
    // Add pixelation effect with nearest neighbor sampling
    const pixelShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "pixelSize": { value: 2.0 },
            "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float pixelSize;
            uniform vec2 resolution;
            varying vec2 vUv;
            
            void main() {
                vec2 texels = resolution;
                vec2 pixelCoord = floor(vUv * texels / pixelSize) * pixelSize;
                vec2 pixelatedUV = pixelCoord / texels;
                
                // Use nearest sampling explicitly
                gl_FragColor = texture2D(tDiffuse, pixelatedUV);
            }
        `
    };

    const pixelPass = new ShaderPass(pixelShader);
    // Update resolution when window resizes
    window.addEventListener('resize', () => {
        pixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });
    composer.addPass(pixelPass);

    // Add bloom effect (more compatible with older Three.js)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.3,  // strength 
        0.3,  // radius
        0.4  // threshold
    );
    composer.addPass(bloomPass);
    
    // Update composer size when window resizes
    window.addEventListener('resize', () => {
        composer.setSize(window.innerWidth, window.innerHeight);
    });
    
    return composer;
}