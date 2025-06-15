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

// Load the road from scene.glb (GLB track with trees)
import { RoadLoader } from './Assets/roadLoader.js';
const roadLoader = new RoadLoader('Road', './Assets/trees_rocks_lamps.glb', scene);
roadLoader.Init();
entityList.push(roadLoader);

// Add a textured background plane underneath the road
import { Plane } from './Assets/plane.js';
const backgroundPlane = new Plane('BackgroundPlane', 1000, 1000);
backgroundPlane.Init();
backgroundPlane.position.set(0, -0.05, 0);

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
            backgroundPlane.object.material.color.setHex(0x969696);
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
car.setScale(0.01, 0.01, 0.01); // Scale the car down

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


// CameraControl import and usage
import { CameraControl } from './Assets/cameraControl.js';
const cameraControl = new CameraControl('CameraControl', 3);
cameraControl.Init(); // Call Init to create the mesh
cameraControl.target = car; 
entityList.push(cameraControl);

// Remove static lights setup

// Initialize dynamic time-of-day cycle
import { TimeOfDay } from './Assets/timeOfDay.js';
const timeCycle = new TimeOfDay('TimeOfDay', scene, {
  cycleDuration: 120, // 24h = 2 minutes real time
  radius: 100,
  keyframes: {
    0:  { ambient:{color:0x0a1929,intensity:10}, directional:{color:0xc7ebff,intensity:1} },    // 12AM
    4:  { ambient:{color:0x0a1929,intensity:15}, directional:{color:0xc7ebff,intensity:1} },    // 4AM
    6:  { ambient:{color:0xb1d0e3,intensity:3}, directional:{color:0xffca7a,intensity:8} },    // 6AM
    10: { ambient:{color:0xddeaed,intensity:3}, directional:{color:0xfff5cc,intensity:4} },  // 12PM
    14: { ambient:{color:0xddeaed,intensity:4}, directional:{color:0xfff5cc,intensity:8} },   // 3PM
    19: { ambient:{color:0xf7d2b2,intensity:4}, directional:{color:0xffca7a,intensity:12} },
    
}
});
entityList.push(timeCycle);

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
    uiContainer.style.width = '30%';
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
    <h3>Game Controls</h3>
    <p>WASD - Move car</p>
    <p>Space - Brake</p>
    <p>Click & Drag - Orbit camera (orbital mode only)</p>
    <p>Mouse Wheel - Zoom in/out</p>
    <p>V - Toggle camera mode (Orbital/Forward-facing)</p>
    <p>C - Toggle stability control</p>
    <p>1/2/3 - Drift sensitivity (stable/balanced/drifty)</p>
    <div id="speed">Speed: 0 km/h</div>
    <div id="steering">Steering: Consistent Torque</div>
    <div id="roadStatus">Road Status: On Road</div>
    <div id="cameraMode">Camera: Orbital Mode</div>
    <div id="timeOfDay">Time: 00:00</div>
    <div id="timerDisplay">00:00.000</div>
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
    },
    updateTimeOfDay: (timeStr) => {
        const td = document.getElementById('timeOfDay');
        if (td) td.textContent = `Time: ${timeStr}`;
    },
    updateTimerDisplay: (timeString) => {
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = timeString;
        }
    }
};
}

// Use it in your main loop
export const ui = createUI();
ui.toggleUI(true); // Show UI on startup

// Make UI available globally for camera control
window.ui = ui;

// In init.js, after other entities
import { Timer } from './Assets/timer.js';
const timer = new Timer('LapTimer');
entityList.push(timer);
// timer.Init(); // Init is called by the main loop

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


