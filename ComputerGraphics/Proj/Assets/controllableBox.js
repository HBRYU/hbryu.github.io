import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context } from '../init.js';  // import world context.

// Inherit from Entity to create a controllable box
export class ControllableBox extends Entity {
    constructor(name) {
        super(name);
        this.speed = 5;
        this.moveLeft = false;
        this.moveRight = false;
        this.targetPosition = new THREE.Vector3(0, 0.5, 0); // Initial target position
    }

    Init() {
        const geometry = new THREE.BoxGeometry();
        // const material = new THREE.MeshStandardMaterial({
        //     color: 0x00ff00,
        //     roughness: 0.1,
        //     metalness: 0.1,
        // });
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Green color
        });
        this.object = new THREE.Mesh(geometry, material);
        this.object.castShadow = false;
        this.object.receiveShadow = false;

        // Create a point light
        const pointLight = new THREE.PointLight(0x00ff00, 3, 10);
        pointLight.position.set(0, 0, 0); // Position above the box
        pointLight.castShadow = true;
        
        // Add the light as a child of the box
        this.object.add(pointLight);
        
        // Set up light shadow properties
        pointLight.shadow.mapSize.width = 512;
        pointLight.shadow.mapSize.height = 512;
        pointLight.shadow.camera.near = 0.1;
        pointLight.shadow.camera.far = 10;
        
        // Make the box unaffected by its own light by adding it to
        // the light's exclude list (available in Three.js r137+)
        pointLight.excludeObjects = [this.object];
        
        // Alternative way to make the box unaffected by the light (for older Three.js versions)
        // Create a light mask by adding the box to a different layer
        // and configure the light to only affect certain layers
        // this.object.layers.set(1);  // Put box on layer 1
        // pointLight.layers.disable(1); // Light doesn't affect layer 1
        // NOTE: If using this approach, ensure other objects are on layer 0
        
        // Store reference to the light
        this.pointLight = pointLight;
    }

    Start() {
        // Set up keyboard listeners
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right mouse button
                this.SetTargetPosition(e);  // Pass the event object
            }
        });

        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    Update(deltaTime) {
        if (this.targetPosition) {
            // Move towards target at constant speed
            const direction = new THREE.Vector3();
            direction.subVectors(this.targetPosition, this.position);

            // Don't move if we're very close to the target
            if (direction.length() >= 0.2) {
                direction.normalize();
                direction.multiplyScalar(this.speed * deltaTime); // Apply speed * deltaTime
                this.position.add(direction);
            } else {
                // Snap to target position if close enough
                this.position.copy(this.targetPosition);
            }
        }
    }

    SetTargetPosition(e) {  // Accept the event as parameter
        // Get mouse position in normalized device coordinates (-1 to +1)
        const mouse = new THREE.Vector2();
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        // Create a raycaster from the camera through the mouse position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, context.camera);

        // Get the ground plane object
        const plane = context.scene.getObjectByName('GroundPlane');
        if (!plane) return;

        // Find intersections with the ground plane
        const intersects = raycaster.intersectObject(plane);

        if (intersects.length > 0) {
            // Move to the intersection point
            this.targetPosition.x = intersects[0].point.x;
            this.targetPosition.z = intersects[0].point.z;
            this.targetPosition.y = 0.5; // Keep the box above the ground
        }
    }
}