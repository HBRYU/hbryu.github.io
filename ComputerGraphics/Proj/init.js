import * as THREE from 'three';
import { Entity } from './entity.js';

// User configures initial entities here
const entityList = [];

//----------------------------------
// Scene - moved up before any scene.add() calls
const scene = new THREE.Scene();

// import { ControllableBox } from './Assets/controllableBox.js';

// const playerBox = new ControllableBox('PlayerBox');
// playerBox.Init(); // Call Init to create the mesh
// playerBox.position.set(0, 0.5, 0); // Set initial position

// entityList.push(playerBox);

// Load the road from TrackTexture3.json (curved track)
import { RoadLoader } from './Assets/roadLoader.js';
const roadLoader = new RoadLoader('Road', './Assets/TrackWTrees.json', scene);
roadLoader.Init();
entityList.push(roadLoader);

// Add a textured background plane underneath the road
import { Plane } from './Assets/plane.js';
const backgroundPlane = new Plane('BackgroundPlane', 1000, 1000);
backgroundPlane.Init();
backgroundPlane.position.set(0, -0.1, 0);

// Load and apply ground texture from GroundTexture.json
const textureLoader = new THREE.TextureLoader();
fetch('./Assets/GroundTexture.json')
    .then(response => response.json())
    .then(groundData => {
        if (groundData.textures && groundData.images && backgroundPlane.object && backgroundPlane.object.material) {
            // Find the diffuse texture
            const diffuseTexture = groundData.textures.find(tex => tex.name.includes('diff'));
            const normalTexture = groundData.textures.find(tex => tex.name.includes('nor'));
            const roughnessTexture = groundData.textures.find(tex => tex.name.includes('rough'));
            
            if (diffuseTexture) {
                // Find corresponding image data
                const diffuseImage = groundData.images.find(img => img.uuid === diffuseTexture.image);
                if (diffuseImage && diffuseImage.url) {
                    // Load the base64 texture
                    const texture = textureLoader.load(diffuseImage.url);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(100, 100); // Tile the texture across the large plane
                    texture.flipY = false;
                    
                    // Apply to material
                    backgroundPlane.object.material.map = texture;
                    backgroundPlane.object.material.needsUpdate = true;
                    
                    console.log('Applied ground diffuse texture');
                }
            }
            
            // Apply normal map if available
            if (normalTexture) {
                const normalImage = groundData.images.find(img => img.uuid === normalTexture.image);
                if (normalImage && normalImage.url) {
                    const normalMap = textureLoader.load(normalImage.url);
                    normalMap.wrapS = THREE.RepeatWrapping;
                    normalMap.wrapT = THREE.RepeatWrapping;
                    normalMap.repeat.set(100, 100);
                    normalMap.flipY = false;
                    
                    backgroundPlane.object.material.normalMap = normalMap;
                    backgroundPlane.object.material.normalScale.set(1, -1); // Match the original normal scale
                    backgroundPlane.object.material.needsUpdate = true;
                    
                    console.log('Applied ground normal map');
                }
            }
            
            // Apply roughness map if available
            if (roughnessTexture) {
                const roughnessImage = groundData.images.find(img => img.uuid === roughnessTexture.image);
                if (roughnessImage && roughnessImage.url) {
                    const roughMap = textureLoader.load(roughnessImage.url);
                    roughMap.wrapS = THREE.RepeatWrapping;
                    roughMap.wrapT = THREE.RepeatWrapping;
                    roughMap.repeat.set(100, 100);
                    roughMap.flipY = false;
                    
                    backgroundPlane.object.material.roughnessMap = roughMap;
                    backgroundPlane.object.material.needsUpdate = true;
                    
                    console.log('Applied ground roughness map');
                }
            }
            
            // Set material properties to match the original
            backgroundPlane.object.material.roughness = 1;
            backgroundPlane.object.material.metalness = 0;
            backgroundPlane.object.material.color.setHex(0xbfb5b0);
        }
    })
    .catch(error => {
        console.warn('Failed to load ground texture, using default white:', error);
        // Fallback to white for contrast with the black road
        if (backgroundPlane.object && backgroundPlane.object.material) {
            backgroundPlane.object.material.color.setHex(0xffffff);
        }
    });

entityList.push(backgroundPlane);

import { Car } from './Assets/car.js';
const car = new Car('Car');
car.Init(); // Call Init to create the mesh
car.setScale(0.015, 0.015, 0.015); // Scale the car down

// Position car at start point (we'll update this once road loads)
car.object.position.set(0, 0, 0); // Car model is slightly above ground, so we can set Y to 0
entityList.push(car);

// Set up car positioning after road loads
let carPositionInterval = setInterval(() => {
    if (roadLoader.isLoaded && car.modelLoaded) {
        // use raw startPosition – no scaling
        let startPos = roadLoader.getStartPosition();

        // default fallback if loader failed to find one
        if (!startPos) {
            console.warn('No start pos, using hard-coded default');
            startPos = new THREE.Vector3(-1.7, 0, -14.4);
        }

        // directly place car at marker + a small Y offset
        car.object.position.set(
            startPos.x,
            startPos.y + 0.5,
            startPos.z
        );
        car.object.rotation.set(0, Math.PI, 0);
        car.alignWithGround();

        if (roadLoader.object) {
            car.setRoadBounds(roadLoader.object);
        }

        clearInterval(carPositionInterval);
        clearTimeout(carPositionTimeout);
        console.log('Car positioned at', car.object.position);
    }
}, 100); // Check every 100ms

// Add timeout to prevent infinite waiting - store reference so we can clear it
const carPositionTimeout = setTimeout(() => {
    clearInterval(carPositionInterval);
    console.warn('Position timeout – forcing default');
    car.object.position.set(0, 0.5, 0);
    if (car.modelLoaded) car.alignWithGround();
}, 5000); // 5 second timeout


import { GrassInstancer } from './Assets/grassInstancer.js';

const grassInstancer = new GrassInstancer(
  './Assets/Grass objects.json',
  roadLoader,       // your already created RoadLoader instance
  3000,              // number of each grass‐mesh
  1200               // half‐size of the square area to scatter over
);

// wait for the road to load before placing grass
roadLoader.Init().then(() => grassInstancer.Init());



// // In init.js
// import { TileMap, TileType } from './Assets/road.js';

// // Create a 20x20 tilemap with 1-unit sized tiles
// const tileMap = new TileMap('WorldMap', 200, 200, 1);

// // Fill the world with grass
// tileMap.fillCheckerBoard(-100, -100, 100, 100, TileType.GRASS, TileType.SAND);

// // Create some water
// tileMap.fillArea(5, 5, 10, 8, TileType.WATER);

// // Create roads
// tileMap.createPath(0, 3, 19, 3, TileType.ROAD);  // Horizontal road
// tileMap.createPath(10, 0, 10, 19, TileType.ROAD); // Vertical road

// // Add to scene
// scene.add(tileMap.object);


import { CameraControl } from './Assets/cameraControl.js';
const cameraControl = new CameraControl('CameraControl', 3);
cameraControl.Init(); // Call Init to create the mesh
cameraControl.target = car; 
entityList.push(cameraControl);

const lights = {
    noon: {
        ambient: {color: 0xa3d3ff, intensity: 1.5},
        directional: {
            color: 0xfff5cc, 
            intensity: 4,
            position: new THREE.Vector3(-10, 20, 10)
        }
    },
    sunset: {
        ambient: {color: 0xdf95e6, intensity: 1.5},
        directional: {
            color: 0xfcba03, 
            intensity: 9,   
            position: new THREE.Vector3(10, 5, -20)
        }
    },
    night: {
        ambient: {color: 0x0a1929, intensity: 100},
        directional: {
            color: 0xc7ebff, 
            intensity: 1,
            position: new THREE.Vector3(-5, 15, 5)
        }
    }
};

// Current lighting mode
let currentLightingMode = 'sunset';

// Add lighting
const ambientLight = new THREE.AmbientLight(
    lights[currentLightingMode].ambient.color, 
    lights[currentLightingMode].ambient.intensity
);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
    lights[currentLightingMode].directional.color, 
    lights[currentLightingMode].directional.intensity
);
directionalLight.position.copy(lights[currentLightingMode].directional.position);
directionalLight.target.position.set(0, 0, 0);
directionalLight.castShadow = true;
directionalLight.shadow.radius = 8; // Soft shadow edge blur
directionalLight.shadow.bias = -0.0005; // Reduce shadow acne

// bigger shadow map for smoother edges
directionalLight.shadow.mapSize.set(2048, 2048); // Increased for better quality

// orthographic volume that encloses a large area around the scene
const cam = directionalLight.shadow.camera;
cam.left = -50;
cam.right = 50;
cam.top = 50;
cam.bottom = -50;
cam.near = 0.1;
cam.far = 100; // Increased far distance
cam.updateProjectionMatrix();

scene.add(directionalLight);

// Camera
// const camera = new THREE.OrthographicCamera(
//     -10, 10, 10, -10, 0.1, 1000
// );
const camera = new THREE.PerspectiveCamera(
    45, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
);
camera.position.set(20, 20, 20); // Set camera position
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the origin


// Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: false // Disable antialiasing for pixelated look
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);

// Set texture filtering to nearest for sharp pixels
// renderer.outputEncoding = THREE.LinearEncoding;
// THREE.defaultTextureFilter = THREE.NearestFilter;

document.body.appendChild(renderer.domElement);

// Add this to your main.js after renderer setup
function createUI() {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '0';
    uiContainer.style.left = '0';
    uiContainer.style.width = '50%';
    uiContainer.style.pointerEvents = 'none'; // Let clicks pass through to canvas
    document.body.appendChild(uiContainer);
    
    // Create a status panel
    const statusPanel = document.createElement('div');
    statusPanel.style.background = 'rgba(0,0,0,0.5)';
    statusPanel.style.color = 'white';
    statusPanel.style.padding = '10px';
    statusPanel.style.margin = '10px';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.fontFamily = 'monospace';
    statusPanel.style.pointerEvents = 'auto'; // This element captures clicks
    uiContainer.appendChild(statusPanel);    // Add content
    statusPanel.innerHTML = `
    <h3>Game Controls</h3>    <p>WASD - Move car</p>
    <p>Space - Brake</p>
    <p>Click & Drag - Orbit camera (orbital mode only)</p>
    <p>Mouse Wheel - Zoom in/out</p>
    <p>V - Toggle camera mode (Orbital/Forward-facing)</p>
    <p>C - Toggle stability control</p>
    <p>1/2/3 - Drift sensitivity (stable/balanced/drifty)</p>    <div id="speed">Speed: 0 km/h</div>
    <div id="steering">Steering: Consistent Torque</div>
    <div id="roadStatus">Road Status: On Road</div>
    <div id="cameraMode">Camera: Orbital Mode</div>
`;

// Return references for updating
return {
    updateSpeed: (speed) => {
        document.getElementById('speed').textContent = `Speed: ${Math.round(speed)} km/h`;
        
        // Steering is now consistent regardless of speed - no need to update steering display
        const steeringElement = document.getElementById('steering');
        if (steeringElement) {
            steeringElement.textContent = `Steering: Consistent Torque`;
        }
        
        // Update road status based on car's current state
        const roadStatusElement = document.getElementById('roadStatus');
        if (roadStatusElement && car) {
            const status = car.isOnRoad ? 'On Road' : 'Off Road (High Friction)';
            const color = car.isOnRoad ? 'white' : '#ff6b6b';
            roadStatusElement.textContent = `Road Status: ${status}`;
            roadStatusElement.style.color = color;
        }
    },
    updateCameraMode: (mode) => {
        const cameraModeElement = document.getElementById('cameraMode');
        if (cameraModeElement) {
            const modeText = mode === 'orbital' ? 'Orbital Mode' : 'Forward-facing Mode';
            cameraModeElement.textContent = `Camera: ${modeText}`;
        }
    },
    toggleUI: (enable) => {
        uiContainer.style.display = enable ? 'block' : 'none';
    }
};
}

// Use it in your main loop
export const ui = createUI();
ui.toggleUI(true); // Show UI on startup

// Make UI available globally for camera control
window.ui = ui;


// Time tracking for deltaTime
const clock = new THREE.Clock();

// Initialize time
clock.current = performance.now() / 1000;
clock.previous = clock.current;

const context = {
    scene,
    camera,
    renderer,
    entityList,
    clock
};

// Export the context for main.js to use
export { context };


// Then make sure to update the helper in your animation loop:
function updateLightingForCamera(cameraPosition) {
    // Update directional light position to be relative to camera
    directionalLight.position.set(
        cameraPosition.x + lights[currentLightingMode].directional.position.x,
        lights[currentLightingMode].directional.position.y,
        cameraPosition.z + lights[currentLightingMode].directional.position.z
    );
    
    // Update light target to follow camera XZ
    directionalLight.target.position.set(cameraPosition.x, 0, cameraPosition.z);
    directionalLight.target.updateMatrixWorld();
    
    // Scale shadow area based on camera height/zoom - much larger coverage
    const cameraHeight = Math.abs(cameraPosition.y);
    const shadowSize = Math.max(100, cameraHeight * 3); // Increased minimum and multiplier
    
    // Update shadow camera - center on camera position for better coverage
    const cam = directionalLight.shadow.camera;
    cam.left = -shadowSize;
    cam.right = shadowSize;
    cam.top = shadowSize;
    cam.bottom = -shadowSize;
    
    // Position shadow camera to center on the target area
    cam.position.set(
        cameraPosition.x + lights[currentLightingMode].directional.position.x,
        lights[currentLightingMode].directional.position.y,
        cameraPosition.z + lights[currentLightingMode].directional.position.z
    );
    
    // Increase shadow distance based on scene size
    cam.near = 0.1;
    cam.far = shadowSize * 3; // Dynamic far plane
    
    cam.updateProjectionMatrix();
}

// Export the function so it can be used in main.js
export { updateLightingForCamera };

