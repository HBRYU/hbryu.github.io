import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context } from '../init.js';

// Inherit from Entity to create a controllable box
export class CameraControl extends Entity {
    constructor(name, speed = 1000) {
        // Pass null for object - we'll create it in Init()
        super(name);
        this.tag = 'cameraControl';
        this.speed = speed; // Speed of camera movement
        this.target = null;  // should be set in init.js
        this.offset = new THREE.Vector3(20, 20, 20); // Offset from the target position
        this.cameraPosition = new THREE.Vector3(0, 0, 0); // Current camera position
        
        // Camera modes
        this.cameraMode = 'orbital'; // 'orbital' or 'forward'
        this.forwardOffset = new THREE.Vector3(0, 12, -25); // Offset behind car for forward mode
        
        // Orbit controls
        this.orbitAngle = 0; // Current horizontal orbit angle in radians
        this.elevationAngle = 0; // Current vertical elevation angle in radians
        this.orbitRadius = Math.sqrt(this.offset.x * this.offset.x + this.offset.z * this.offset.z); // Distance from target
        this.orbitHeight = this.offset.y; // Base height above target
        this.mouseSensitivity = 0.005; // Mouse sensitivity for orbiting
        this.minRadius = 3; // Minimum orbit radius
        this.maxRadius = 20; // Maximum orbit radius
        this.minElevation = -Math.PI * 0.4; // Minimum elevation angle (looking down)
        this.maxElevation = Math.PI * 0.4; // Maximum elevation angle (looking up)
        
        // Mouse tracking
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isMouseDown = false;
        
        // Bind mouse events and keyboard controls
        this.setupMouseControls();
        this.setupKeyboardControls();
    }    Init() {
        // this.object = context.camera;
    }    setupMouseControls() {
        // Choose orbit control method:
        // Method 1: Click and drag to orbit
        // Method 2: Mouse X position continuously controls orbit (uncomment the section below)
        
        // Method 1: Click and drag orbiting
        window.addEventListener('mousemove', (event) => {
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
            
            if (this.isMouseDown && this.cameraMode === 'orbital') {
                this.updateOrbitFromMouse();
            }
        });

        window.addEventListener('mousedown', (event) => {
            if (this.cameraMode === 'orbital') {
                this.isMouseDown = true;
                this.lastMouseX = event.clientX;
                this.lastMouseY = event.clientY;
            }
        });

        window.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        // Mouse wheel zoom for both modes
        window.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            if (this.cameraMode === 'orbital') {
                // Orbital mode: zoom in/out by changing orbit radius
                const zoomSpeed = 0.001;
                this.orbitRadius += event.deltaY * zoomSpeed;
                this.orbitRadius = Math.max(this.minRadius, Math.min(this.maxRadius, this.orbitRadius));
            } else if (this.cameraMode === 'forward') {
                // Forward mode: zoom in/out by changing the offset distance
                const zoomSpeed = 0.01;
                const offsetLength = this.forwardOffset.length();
                const newLength = Math.max(5, Math.min(30, offsetLength + event.deltaY * zoomSpeed));
                this.forwardOffset.normalize().multiplyScalar(newLength);
            }
        });

        // Method 2: Continuous mouse X position orbiting (uncomment to use instead of click-drag)
        /*
        window.addEventListener('mousemove', (event) => {
            // Map mouse X position (0 to window width) to orbit angle (0 to 2π)
            const normalizedX = event.clientX / window.innerWidth;
            this.orbitAngle = normalizedX * Math.PI * 2;
        });
        */
    }
    
    setupKeyboardControls() {
        window.addEventListener('keydown', (event) => {
            switch(event.key.toLowerCase()) {
                case 'v': // Toggle camera mode
                    this.toggleCameraMode();
                    break;
            }
        });
    }
      toggleCameraMode() {
        this.cameraMode = this.cameraMode === 'orbital' ? 'forward' : 'orbital';
        console.log(`Camera mode switched to: ${this.cameraMode}`);
        
        // Update UI if available
        if (typeof window !== 'undefined' && window.ui && window.ui.updateCameraMode) {
            window.ui.updateCameraMode(this.cameraMode);
        }
    }updateOrbitFromMouse() {
        const deltaX = this.mouseX - this.lastMouseX;
        const deltaY = this.mouseY - this.lastMouseY;
        
        // Update horizontal orbit angle
        this.orbitAngle += deltaX * this.mouseSensitivity;
        
        // Update vertical elevation angle
        this.elevationAngle += deltaY * this.mouseSensitivity;
        
        // Clamp elevation angle to prevent camera from flipping
        this.elevationAngle = Math.max(this.minElevation, Math.min(this.maxElevation, this.elevationAngle));
        
        this.lastMouseX = this.mouseX;
        this.lastMouseY = this.mouseY;
    }    Start() {
        // Initialize orbit angle based on initial offset
        this.orbitAngle = Math.atan2(this.offset.x, this.offset.z);
        // Initialize elevation angle based on initial height
        this.elevationAngle = Math.atan2(this.offset.y, this.orbitRadius);
        this.updateCameraPosition();
    }
    
    updateCameraPosition() {
        if (!this.target) return;
        
        if (this.cameraMode === 'orbital') {
            // Calculate orbital position around target with both horizontal and vertical angles
            const horizontalDistance = this.orbitRadius * Math.cos(this.elevationAngle);
            const x = Math.sin(this.orbitAngle) * horizontalDistance;
            const z = Math.cos(this.orbitAngle) * horizontalDistance;
            const y = this.orbitRadius * Math.sin(this.elevationAngle);
            
            // Set camera target position based on orbit
            this.cameraTargetPosition = new THREE.Vector3(
                this.target.position.x + x,
                this.target.position.y + this.orbitHeight + y,
                this.target.position.z + z
            );        } else if (this.cameraMode === 'forward') {
            // Forward-facing camera mode: position camera behind car facing forward
            const carRotation = this.target.object ? this.target.object.rotation.y : 0;
            
            // Create offset vector in local space (behind the car)
            const localOffset = this.forwardOffset.clone();
            
            // Rotate offset based on car's rotation
            const rotationMatrix = new THREE.Matrix4().makeRotationY(carRotation);
            localOffset.applyMatrix4(rotationMatrix);
            
            // Set camera target position behind car
            this.cameraTargetPosition = new THREE.Vector3(
                this.target.position.x + localOffset.x,
                this.target.position.y + localOffset.y,
                this.target.position.z + localOffset.z
            );
        }
    }
      Update(deltaTime) {
        this.updateCameraPosition();
        
        // Smoothly move camera to target position
        this.cameraPosition.lerp(this.cameraTargetPosition, this.speed * deltaTime);
        context.camera.position.copy(this.cameraPosition);
        
        // Set camera look-at based on mode
        if (this.target) {
            if (this.cameraMode === 'orbital') {
                // Orbital mode: always look at the car
                context.camera.lookAt(this.target.position);
            } else if (this.cameraMode === 'forward') {
                // Forward mode: look in the direction the car is facing
                const carRotation = this.target.object ? this.target.object.rotation.y : 0;
                
                // Calculate a point in front of the car
                const lookAtDistance = 20;
                const lookAtPoint = new THREE.Vector3(
                    this.target.position.x + Math.sin(carRotation) * lookAtDistance,
                    this.target.position.y,
                    this.target.position.z + Math.cos(carRotation) * lookAtDistance
                );
                
                context.camera.lookAt(lookAtPoint);
            }
        }
    }
}