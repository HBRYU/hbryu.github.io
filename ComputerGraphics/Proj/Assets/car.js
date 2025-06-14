import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context, ui } from '../init.js';  // import world context.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Inherit from Entity to create a controllable box
export class Car extends Entity {
    constructor(name) {
        super(name);

        // Physics properties
        this._velocity = new THREE.Vector2(0, 0);
        this._angularVelocity = 0;

        // Car performance specs - UPDATED FOR BETTER CONTROL
        this.maxSpeed = 80;
        this.engineForce = 12000;   // Reduced slightly for better control
        this.brakeForce = 120000;
        // Physical properties - UPDATED FOR STABILITY
        this.mass = 1800;
        this.momentOfInertia = 2500; // Increased for more stability
        this.dragCoefficient = 0.55; // Increased for more realistic air resistance

        // Tire properties - UPDATED FOR BETTER GRIP
        this.tireFriction = 0.99;     // Slightly reduced for more realistic sliding
        this.tireGrip = 0.99;         // Reduced from 0.99 for more progressive sliding
        this.corneringStiffness = 250000; // Reduced for less aggressive cornering

        // NEW: Stability control properties
        this.stabilityControl = true;  // Enable electronic stability control
        this.maxSlipAngle = 0.3;      // Maximum slip angle before stability kicks in (radians ~17 degrees)
        this.stabilityFactor = 0.2;   // How much stability control reduces forces (0-1)
        this.antiSpinDamping = 0.5;  // Additional angular velocity damping during slides

        // Input state
        this.accelPressed = false;
        this.brakePressed = false;
        this.leftPressed = false;
        this.rightPressed = false;
        this.modelLoaded = false;
        this.modelScale = new THREE.Vector3(1, 1, 1); // Default scale

        // Create a group to hold the model
        this.object = new THREE.Group();
        this.object.name = name;

        // Set up input handlers
        this.setupInputHandlers();
        // Debug vectors
        this.velocityArrow = null;
        this.forceArrow = null;
        // Road detection for friction adjustment
        this.roadBounds = [];
        this.isOnRoad = true;
        this.offRoadFrictionMultiplier = 20; // Increase friction when off-road
        this.offRoadDragMultiplier = 40; // Increase drag when off-road (grass, dirt resistance)
    }

    setupInputHandlers() {
        // Key down handler
        window.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'ArrowUp':
                case 'w':
                    this.accelPressed = true;
                    break;
                case 'ArrowDown':
                case 's':
                    this.brakePressed = true;
                    break;
                case 'ArrowLeft':
                case 'a':
                    this.leftPressed = true;
                    break;
                case 'ArrowRight':
                case 'd':
                    this.rightPressed = true;
                    break;
                case 'c': // Toggle stability control
                    this.toggleStabilityControl();
                    break;
                case '1': // Stable setup
                    this.setDriftSensitivity(0.2);
                    break;
                case '2': // Balanced setup
                    this.setDriftSensitivity(0.5);
                    break;
                case '3': // Drift setup
                    this.setDriftSensitivity(0.8);
                    break;
            }
        });

        // Key up handler
        window.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'ArrowUp':
                case 'w':
                    this.accelPressed = false;
                    break;
                case 'ArrowDown':
                case 's':
                    this.brakePressed = false;
                    break;
                case 'ArrowLeft':
                case 'a':
                    this.leftPressed = false;
                    break;
                case 'ArrowRight':
                case 'd':
                    this.rightPressed = false;
                    break;
            }
        });
    } Init() {
        // Load the 3D car model from JSON
        const loader = new THREE.ObjectLoader();

        loader.load(
            './Assets/_car.json',
            (carModel) => {
                console.log("Car model loaded successfully");

                // Apply the stored scale to the loaded model
                carModel.scale.copy(this.modelScale);

                // Find Object001 specifically for shadow/collision purposes
                let object001 = null;
                carModel.traverse((child) => {
                    // Look specifically for Object001 or its mesh child
                    if (child.name === 'Object001' || child.name === 'Object001_Material_#37_0') {
                        object001 = child;
                        console.log("Found Object001:", child.name);
                    }

                    // Set up all meshes for rendering but we'll handle shadows separately
                    if (child.isMesh) {
                        // Enhanced material properties
                        if (child.material) {
                            child.material.metalness = 0.3;
                            child.material.roughness = 0.7;
                        }

                        // Only enable shadows for Object001 (main car body)
                        if (child.name === 'Object001_Material_#37_0' ||
                            (child.parent && child.parent.name === 'Object001')) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            console.log("Enabled shadows for main car body:", child.name);
                        } else {
                            // Disable shadows for other parts (like windows, details)
                            child.castShadow = false;
                            child.receiveShadow = false;
                        }
                    }
                });

                // Store reference to Object001 for collision/physics calculations
                this.mainBodyMesh = object001;

                // If we found Object001, use it for physics bounds
                if (this.mainBodyMesh) {
                    // Calculate bounding box for Object001 specifically
                    const box = new THREE.Box3().setFromObject(this.mainBodyMesh);
                    this.physicsSize = {
                        width: box.max.x - box.min.x,
                        height: box.max.y - box.min.y,
                        length: box.max.z - box.min.z
                    };
                    console.log("Physics bounds from Object001:", this.physicsSize);
                }

                // Add the entire model to our group
                this.object.add(carModel);

                // Add simple indicators for front/back (positioned relative to Object001 if available)
                const frontIndicator = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.05, 0.02),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );

                // Position indicator at front of Object001 if available, otherwise use default
                if (this.mainBodyMesh) {
                    const box = new THREE.Box3().setFromObject(this.mainBodyMesh);
                    frontIndicator.position.z = box.max.z + 0.1; // Slightly in front
                    frontIndicator.position.y = box.max.y * 0.8; // Near top
                } else {
                    frontIndicator.position.z = 1;
                    frontIndicator.position.y = 0.3;
                }

                this.object.add(frontIndicator);

                // Create debug arrows
                this.createDebugArrows();

                // Flag the model as loaded
                this.modelLoaded = true;
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading car model:', error);
                console.log('Falling back to simple box geometry');

                // Fallback: create the original simple box
                const geometry = new THREE.BoxGeometry(1, 0.5, 2);
                const material = new THREE.MeshStandardMaterial({
                    color: 0x3366cc,
                    metalness: 0.5,
                    roughness: 0.5
                });

                const boxMesh = new THREE.Mesh(geometry, material);
                boxMesh.castShadow = true;
                boxMesh.receiveShadow = true;

                // Store fallback mesh as main body
                this.mainBodyMesh = boxMesh;
                this.physicsSize = { width: 1, height: 0.5, length: 2 };

                this.object.add(boxMesh);
                this.object.position.y = 0.0;

                // Add front indicator
                const frontIndicator = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 0.1, 0.1),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );
                frontIndicator.position.z = 1;
                frontIndicator.position.y = 0.3;
                this.object.add(frontIndicator);

                this.createDebugArrows();
                this.modelLoaded = true;
            }
        );
    }

    // Fallback method to create simple box geometry if model loading fails
    createFallbackGeometry() {
        const geometry = new THREE.BoxGeometry(1, 0.5, 2);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3366cc,
            metalness: 0.5,
            roughness: 0.5
        });

        const boxMesh = new THREE.Mesh(geometry, material);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;

        this.object.add(boxMesh);

        // Position and add front indicator
        this.object.position.y = 0.0;

        const frontIndicator = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        frontIndicator.position.z = 1;
        frontIndicator.position.y = 0.3;
        this.object.add(frontIndicator);

        this.createDebugArrows();
        this.modelLoaded = true;
    }

    // Method to set the scale of the car model
    setScale(x, y, z) {
        // If only one parameter is provided, use it for all axes (uniform scaling)
        if (typeof y === 'undefined' && typeof z === 'undefined') {
            this.modelScale.set(x, x, x);
        } else {
            this.modelScale.set(x, y || x, z || x);
        }

        // If model is already loaded, apply the scale immediately
        if (this.modelLoaded && this.object.children.length > 0) {
            // Find the car model child (first non-arrow object)
            this.object.children.forEach((child) => {
                // Skip arrows and indicators
                if (!child.isArrowHelper && child.type !== 'Mesh') {
                    child.scale.copy(this.modelScale);
                }
            });
        }
    }

    // Method to get the current scale
    getScale() {
        return this.modelScale.clone();
    }

    createDebugArrows() {
        // Velocity arrow (blue)
        const velocityArrowHelper = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0.5, 0),
            1,
            0x0000ff
        );
        this.object.add(velocityArrowHelper);
        this.velocityArrow = velocityArrowHelper;

        // Force arrow (red)
        const forceArrowHelper = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0.5, 0),
            1,
            0xff0000
        );
        this.object.add(forceArrowHelper);
        this.forceArrow = forceArrowHelper;
    }

    Start() {
        // Initialize any state when the car is added to the scene
        console.log("Car controls: WASD or Arrow keys to drive");
    } 

    Update(deltaTime) {
        if (!this.modelLoaded) return; // Wait until model is loaded

        // Apply time step constraints to prevent instability
        const maxDeltaTime = 0.05; // Cap at 20 FPS for physics stability
        const constrainedDeltaTime = Math.min(deltaTime, maxDeltaTime);

        // Check if car is on road for friction adjustment
        this.checkIfOnRoad();

        // Calculate forces in local car space
        const forces = this.calculateForces(constrainedDeltaTime);

        // Convert to world space and update velocities
        this.applyForces(forces, constrainedDeltaTime);

        // Apply velocity constraints to prevent numerical instability
        this.constrainVelocities();

        // Apply velocities to update position and orientation
        this.updatePosition(constrainedDeltaTime);

        // Update debug visualization
        this.updateDebugArrows();

        // Update UI
        if (ui && ui.updateSpeed) {
            ui.updateSpeed(this.getSpeed() * 1.8); // m/s to km/h / 2 for scale
        }

        console.log(`Car position: (${this.object.position.x.toFixed(2)}, ${this.object.position.y.toFixed(2)}, ${this.object.position.z.toFixed(2)})`);
    }

    calculateForces(deltaTime) {
        const forces = {
            longitudinal: 0,
            lateral: 0,
            torque: 0
        };

        const localVelocity = this.getLocalVelocity();
        const forwardVelocity = localVelocity.y;
        const lateralVelocity = localVelocity.x;
        const speed = this.getSpeed();

        // Engine forces (removed stability control interference)
        if (this.accelPressed) {
            const speedFactor = Math.max(0.2, 1.0 - Math.pow(forwardVelocity / this.maxSpeed, 2));
            forces.longitudinal += this.engineForce * speedFactor; // No stabilityFactor here
        }

        // Braking forces
        if (this.brakePressed) {
            const brakeEfficiency = Math.min(1.0, Math.max(0.2, Math.abs(forwardVelocity) / 5.0));
            forces.longitudinal -= Math.sign(forwardVelocity) * this.brakeForce * brakeEfficiency;
        }        // Air resistance - Enhanced for more realistic physics with off-road detection
        const baseDragCoefficient = 0.5 * this.dragCoefficient * 1.225; // Air density at sea level
        const frontalArea = 2.4; // Slightly increased frontal area for more realistic drag

        // Apply off-road drag multiplier if car is off-road (grass, dirt, sand resistance)
        const dragMultiplier = this.isOnRoad ? 1.0 : this.offRoadDragMultiplier;
        const effectiveDragCoefficient = baseDragCoefficient * dragMultiplier;

        const dragForce = effectiveDragCoefficient * frontalArea * speed * speed;

        if (speed > 0.01) {
            forces.longitudinal -= (forwardVelocity / speed) * dragForce;
            forces.lateral -= (lateralVelocity / speed) * dragForce;

            // Debug output for off-road drag
            if (!this.isOnRoad && speed > 5.0) { // Only log at reasonable speeds
                console.log(`OFF-ROAD: Increased drag by ${dragMultiplier}x (Speed: ${(speed * 3.6).toFixed(1)} km/h)`);
            }
        }

        // Rolling resistance - Increased for more realistic feel
        const rollingResistanceCoefficient = 0.020; // Increased from 0.015 for more realistic deceleration
        const normalForce = this.mass * 9.81;
        const rollingResistance = rollingResistanceCoefficient * normalForce;

        if (Math.abs(forwardVelocity) > 0.1) {
            forces.longitudinal -= Math.sign(forwardVelocity) * rollingResistance;
        } else if (Math.abs(forwardVelocity) <= 0.1 && !this.accelPressed) {
            forces.longitudinal = -forwardVelocity * this.mass / deltaTime;
        }
        // Simplified lateral friction with off-road detection
        if (Math.abs(lateralVelocity) > 0.05) {
            // Apply off-road friction multiplier if car is off-road
            const frictionMultiplier = this.isOnRoad ? 1.0 : this.offRoadFrictionMultiplier;
            const effectiveFriction = this.tireFriction * frictionMultiplier;

            const lateralFrictionForce = -effectiveFriction * normalForce * Math.sign(lateralVelocity);
            forces.lateral += lateralFrictionForce;

            // Debug output for off-road detection
            if (!this.isOnRoad) {
                console.log(`OFF-ROAD: Increased friction by ${frictionMultiplier}x`);
            }
        }
        // CONSISTENT TORQUE STEERING: Apply same torque regardless of speed
        const steeringInput = this.leftPressed ? 1 : (this.rightPressed ? -1 : 0);

        if (steeringInput !== 0 && Math.abs(forwardVelocity) > 0.5) {
            // Fixed steering angle (no speed dependency for input)
            const maxSteeringAngle = 0.5;
            const steeringAngle = steeringInput * maxSteeringAngle;

            // Calculate cornering force - this is where speed matters for physics
            const currentSlipAngle = Math.atan2(lateralVelocity, Math.abs(forwardVelocity));
            const targetSlipAngle = currentSlipAngle - steeringAngle;

            // Cornering force proportional to speed for realistic physics
            let corneringForce = -this.corneringStiffness * targetSlipAngle;

            // Limit cornering force
            const maxCorneringForce = 15000;
            corneringForce = Math.max(-maxCorneringForce, Math.min(corneringForce, maxCorneringForce));

            forces.lateral += corneringForce;

            // PHYSICS-BASED TORQUE: Torque proportional to speed for realistic cornering
            const wheelbase = 2.5;

            // The faster you go, the more torque is generated from the same cornering force
            // This creates realistic understeer at high speeds while maintaining control
            const baseTorque = corneringForce * (wheelbase / 2) * Math.sign(forwardVelocity);

            // Speed factor for torque - more torque at higher speeds (realistic physics)
            const speedFactor = Math.min(Math.abs(forwardVelocity) / 10, 2.0); // Cap at 2x for very high speeds
            const speedProportionalTorque = baseTorque * speedFactor;

            // Add minimum torque for low-speed maneuverability
            const minimumTorque = steeringInput * 8000; // Base torque for parking/low-speed turns

            // Combine physics-based torque with minimum torque
            const combinedTorque = speedProportionalTorque + minimumTorque;

            // UPPER BOUND: Limit maximum torque to prevent instability
            const maxTorque = 25000; // Maximum allowable torque
            const finalTorque = Math.max(-maxTorque, Math.min(combinedTorque, maxTorque));

            forces.torque += finalTorque;

            // Debug output for understanding the physics
            const speedKmh = Math.abs(forwardVelocity) * 3.6;
            if (speedKmh > 20) {
                console.log(`Physics steering - Speed: ${speedKmh.toFixed(1)} km/h, Speed Factor: ${speedFactor.toFixed(2)}x, Torque: ${finalTorque.toFixed(0)} (max: ${maxTorque})`);
            }
        }

        return forces;
    }

    applyForces(forces, deltaTime) {
        // Get car's rotation
        const carRotation = this.object.rotation.y;

        // Convert local forces to world space using rotation matrix
        const worldForceX = forces.longitudinal * Math.sin(carRotation) + forces.lateral * Math.cos(carRotation);
        const worldForceZ = forces.longitudinal * Math.cos(carRotation) - forces.lateral * Math.sin(carRotation);

        // Apply forces to velocity (F = ma, so a = F/m)
        const accelerationX = worldForceX / this.mass;
        const accelerationZ = worldForceZ / this.mass;

        // Update velocities
        this._velocity.x += accelerationX * deltaTime;
        this._velocity.y += accelerationZ * deltaTime;

        // Apply torque to angular velocity
        const angularAcceleration = forces.torque / this.momentOfInertia;
        this._angularVelocity += angularAcceleration * deltaTime;
    }

    constrainVelocities() {
        // Constrain linear velocity
        const speed = this.getSpeed();
        if (speed > this.maxSpeed) {
            this._velocity.x = (this._velocity.x / speed) * this.maxSpeed;
            this._velocity.y = (this._velocity.y / speed) * this.maxSpeed;
        }

        // Stop creeping at very low speeds
        if (speed < 0.1 && !this.accelPressed && !this.brakePressed) {
            this._velocity.x = 0;
            this._velocity.y = 0;
        }

        // Basic angular velocity constraints
        const maxAngularVelocity = 3.0;
        if (Math.abs(this._angularVelocity) > maxAngularVelocity) {
            this._angularVelocity = Math.sign(this._angularVelocity) * maxAngularVelocity;
        }

        // Simple angular damping (no adaptive damping based on slip)
        this._angularVelocity *= 0.95;

        // Stop small oscillations
        if (Math.abs(this._angularVelocity) < 0.01) {
            this._angularVelocity = 0;
        }
    }

    updatePosition(deltaTime) {
        // Update position based on velocity
        this.object.position.x += this._velocity.x * deltaTime;
        this.object.position.z += this._velocity.y * deltaTime;

        // Update rotation based on angular velocity
        this.object.rotation.y += this._angularVelocity * deltaTime;

        // Normalize rotation to prevent accumulation errors
        this.object.rotation.y = this.object.rotation.y % (2 * Math.PI);
    }

    updateDebugArrows() {
        if (this.velocityArrow) {
            // Update velocity arrow
            const speed = this.getSpeed();
            if (speed > 0.1) {
                const velocityDirection = new THREE.Vector3(
                    this._velocity.x / speed,
                    0,
                    this._velocity.y / speed
                );
                this.velocityArrow.setDirection(velocityDirection);
                this.velocityArrow.setLength(Math.min(speed, 5));
                this.velocityArrow.visible = true;
            } else {
                this.velocityArrow.visible = false;
            }
        }

        if (this.forceArrow) {
            // We can visualize engine/brake force
            const forceDirection = this.accelPressed ?
                new THREE.Vector3(0, 0, 1) :
                (this.brakePressed ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 0));

            const forceMagnitude = this.accelPressed ?
                this.engineForce / this.mass :
                (this.brakePressed ? this.brakeForce / this.mass : 0);

            this.forceArrow.setDirection(forceDirection);
            this.forceArrow.setLength(Math.min(forceMagnitude, 5));
            this.forceArrow.visible = forceMagnitude > 0.1;
        }
    }

    getSpeed() {
        // Calculate total speed from velocity components
        return Math.sqrt(this._velocity.x * this._velocity.x + this._velocity.y * this._velocity.y);
    }

    // Helper method to get velocity in local car space
    getLocalVelocity() {
        const carRotation = this.object.rotation.y;
        const cosRot = Math.cos(carRotation);
        const sinRot = Math.sin(carRotation);

        // Convert world velocity to local car space (rotation matrix)
        const localVelocityX = this._velocity.x * cosRot - this._velocity.y * sinRot; // Lateral
        const localVelocityZ = this._velocity.x * sinRot + this._velocity.y * cosRot; // Longitudinal

        return new THREE.Vector2(localVelocityX, localVelocityZ);
    }

    // Add method to get the main body mesh for collision detection
    getMainBodyMesh() {
        return this.mainBodyMesh;
    }

    // Add method to get physics bounds based on Object001
    getPhysicsBounds() {
        if (this.mainBodyMesh) {
            const box = new THREE.Box3().setFromObject(this.mainBodyMesh);
            return {
                min: box.min,
                max: box.max,
                size: {
                    width: box.max.x - box.min.x,
                    height: box.max.y - box.min.y,
                    length: box.max.z - box.min.z
                }
            };
        }
        return null;
    }

    // Update collision detection method
    checkCollisionWith(otherObject) {
        if (!this.mainBodyMesh) return false;

        // Use Object001's bounding box for collision detection
        const thisBox = new THREE.Box3().setFromObject(this.mainBodyMesh);
        const otherBox = new THREE.Box3().setFromObject(otherObject);

        return thisBox.intersectsBox(otherBox);
    }

    // NEW: Method to toggle stability control
    toggleStabilityControl() {
        this.stabilityControl = !this.stabilityControl;
        console.log("Stability control:", this.stabilityControl ? "ON" : "OFF");
    }

    // NEW: Method to adjust drift sensitivity
    setDriftSensitivity(sensitivity) {
        // sensitivity: 0 = very stable, 1 = very drifty
        this.maxSlipAngle = 0.2 + (sensitivity * 0.3); // 0.2 to 0.5 radians
        this.stabilityFactor = 0.9 - (sensitivity * 0.4); // 0.9 to 0.5
        this.antiSpinDamping = 0.95 - (sensitivity * 0.1); // 0.95 to 0.85
        console.log(`Drift sensitivity set to ${sensitivity} (slip angle: ${this.maxSlipAngle.toFixed(2)})`);
    }
    // NEW: Method to set road boundaries for off-road detection
    setRoadBounds(roadObject) {
        if (!roadObject) return;

        this.roadBounds = [];
        this.roadMesh = null;

        // Find the actual road mesh (Plane) with geometry data
        roadObject.traverse((child) => {
            if (child.isMesh && child.name === 'Plane') {
                this.roadMesh = child;
                console.log(`Car: Found road mesh 'Plane' for curved path detection`);
            }
            // Keep existing bounding box system as fallback
            else if (child.isMesh && child.name !== 'Start' && child.name !== 'Finish') {
                const box = new THREE.Box3().setFromObject(child);
                this.roadBounds.push({
                    min: box.min,
                    max: box.max,
                    name: child.name
                });
            }
        });

        console.log(`Car: Road detection setup - Found ${this.roadMesh ? 'curved mesh' : 'no mesh'}, ${this.roadBounds.length} fallback bounds`);
    }
    // NEW: Check if car is currently on the road
    checkIfOnRoad() {
        if (!this.roadMesh && this.roadBounds.length === 0) {
            this.isOnRoad = true; // Default to on-road if no bounds set
            return true;
        }

        const carPosition = this.object.position;

        // First try curved mesh detection if available
        if (this.roadMesh && this.isPointOnCurvedTrack(carPosition)) {
            this.isOnRoad = true;
            return true;
        }

        // Fallback to bounding box detection
        if (this.roadBounds.length > 0) {
            for (const bound of this.roadBounds) {
                if (carPosition.x >= bound.min.x && carPosition.x <= bound.max.x &&
                    carPosition.z >= bound.min.z && carPosition.z <= bound.max.z &&
                    carPosition.y >= bound.min.y - 1 && carPosition.y <= bound.max.y + 1) {
                    this.isOnRoad = true;
                    return true;
                }
            }
        }

        this.isOnRoad = false;
        return false;
    }

    // NEW: Check if a point is on the curved track using raycasting
    isPointOnCurvedTrack(position) {
        if (!this.roadMesh) return false;

        const raycaster = new THREE.Raycaster();

        // Cast ray downward from above the car position
        const rayOrigin = new THREE.Vector3(position.x, position.y + 10, position.z);
        const rayDirection = new THREE.Vector3(0, -1, 0);

        raycaster.set(rayOrigin, rayDirection);

        // Check intersection with the road mesh
        const intersections = raycaster.intersectObject(this.roadMesh, false);

        if (intersections.length > 0) {
            const intersection = intersections[0];
            // Allow some tolerance for Y position (car might be slightly above/below road)
            const heightDifference = Math.abs(intersection.point.y - position.y);

            // If the intersection is close to the car's Y position, we're on the road
            if (heightDifference < 2.0) { // 2 unit tolerance
                return true;
            }
        }

        return false;
    }    // NEW: Method to align car's bottom with ground level (y=0)
    alignWithGround() {
        if (!this.modelLoaded) {
            console.warn("Car model not loaded yet, cannot align with ground");
            return;
        }

        if (!this.object || this.object.children.length === 0) {
            console.warn("Car object not ready, cannot align with ground");
            return;
        }

        // Calculate the bounding box of the entire car object
        const box = new THREE.Box3().setFromObject(this.object);

        // Check if the bounding box is valid
        if (box.isEmpty()) {
            console.warn("Car bounding box is empty, using default ground alignment");
            this.object.position.y = 0.5; // Default height
            return;
        }

        // Get the current bottom of the car
        const carBottom = box.min.y;

        // Adjust the car's Y position so its bottom aligns with y=0
        const currentY = this.object.position.y;
        const adjustmentY = -carBottom; // Move up by the amount the bottom is below y=0

        this.object.position.y = currentY + adjustmentY;

        console.log(`Car aligned with ground: bottom was at ${carBottom.toFixed(3)}, adjusted by ${adjustmentY.toFixed(3)}, now at y=${this.object.position.y.toFixed(3)}`);
    }
}

