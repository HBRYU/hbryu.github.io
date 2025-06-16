import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context, ui } from '../init.js';  // import world context.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Inherit from Entity to create a controllable box
export class Car extends Entity {
    constructor(name) { // glbPath removed as it's consistent
        super(name);

        // Physics properties
        this._velocity = new THREE.Vector2(0, 0);
        this._angularVelocity = 0;

        // Car performance specs
        this.maxSpeed = 80;
        this.engineForce = 8000;
        this.brakeForce = 120000;
        // Physical properties
        this.mass = 2400;
        this.momentOfInertia = 3500; // Increased for more stable rotation, less twitchy
        this.dragCoefficient = 0.55;

        // Tire properties
        this.tireFriction = 0.8; // Overall friction, affects rolling resistance and general deceleration
        this.tireGrip = 0.4;     // Affects how strongly tires resist lateral slip and align to steering. Range ~0.5 (slippery) to ~2.5 (very grippy)
        this.corneringStiffness = 280000; // How sharply tires respond to steering input to generate cornering force

        // Stability control properties
        this.stabilityControl = true;
        this.maxSlipAngle = 0.3;
        this.stabilityFactor = 0.2;
        this.antiSpinDamping = 0.5;

        // Input state
        this.accelPressed = false;
        this.brakePressed = false;
        this.leftPressed = false;
        this.rightPressed = false;
        this.modelLoaded = false;
        this.modelScale = new THREE.Vector3(1, 1, 1);

        // Headlight properties
        this.headlights = []; // Store headlight objects
        this.headlightHelpers = []; // Store SpotLightHelper objects
        this.headlightsOn = false; // Start with headlights off
        this.manuallyToggledHeadlights = false; // Track if user manually toggled

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
                case 'l': // Toggle headlights
                case 'L':
                    this.toggleHeadlights();
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
            './Assets/car.json',
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

                // Create and add headlights
                this.createHeadlights(); // Called after model is scaled and added

                // Add simple indicators for front/back (positioned relative to Object001 if available)
                const frontIndicator = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1 * this.modelScale.x, 0.05 * this.modelScale.y, 0.02 * this.modelScale.z), // Scale indicator
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );

                // Position indicator at front of Object001 if available, otherwise use default
                if (this.mainBodyMesh) {
                    const box = new THREE.Box3().setFromObject(this.mainBodyMesh); // Bbox of unscaled model part
                    frontIndicator.position.z = (box.max.z + 0.1) * this.modelScale.z; // Slightly in front, scaled
                    frontIndicator.position.y = (box.max.y * 0.8) * this.modelScale.y; // Near top, scaled
                } else {
                    // Fallback for indicator if mainBodyMesh not found (should not happen with current logic)
                    frontIndicator.position.z = 1 * this.modelScale.z;
                    frontIndicator.position.y = 0.3 * this.modelScale.y;
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
                // Fallback logic removed. If model fails, car will be invisible and non-functional.
                // Consider adding a very simple placeholder if critical, but per request, removing full fallback.
                this.modelLoaded = false; // Ensure model is not marked as loaded
                console.log("Car model loading failed. No fallback geometry will be created.");
            }
        );
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

        // Get timeOfDay from context if available
        // entities is not iterable
        for (const entity of context.entityList) {
            if (entity.name === 'TimeOfDay') {
                this.timeOfDay = entity; // Store reference to timeOfDay entity
                console.log("Car found timeOfDay entity:", this.timeOfDay);
                break;
            }
        }
        //this.elapsed = (initialHour / 24) * this.cycleDuration;
    } 

    Update(deltaTime) {
        if (!this.modelLoaded) return; // Wait until model is loaded

        // Apply time step constraints to prevent instability
        const maxDeltaTime = 0.05; // Cap at 20 FPS for physics stability
        const constrainedDeltaTime = Math.min(deltaTime, maxDeltaTime);

        // Check if car is on road for friction adjustment
        this.checkIfOnRoad();

        // Auto-headlights: Check time of day and turn on lights at night if they're not manually controlled
        this.checkAutoHeadlights();

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
            ui.updateSpeed(this.getSpeed() * 3.6); // m/s to km/h
        }

        // 
        // console.log(`Car position: (${this.object.position.x.toFixed(2)}, ${this.object.position.y.toFixed(2)}, ${this.object.position.z.toFixed(2)})`);
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
            // Stronger force to bring car to a stop if no acceleration is applied at very low speeds
            forces.longitudinal = -forwardVelocity * this.mass / (deltaTime + 0.001); // Add small epsilon to avoid division by zero
        }

        // --- Steering and Tire Grip Physics ---
        const steeringInput = this.leftPressed ? 1 : (this.rightPressed ? -1 : 0);
        // const normalForce = this.mass * 9.81; // Already defined above, ensure it's available or pass as param

        if (steeringInput !== 0 && Math.abs(forwardVelocity) > 0.2) { // Min speed for steering
            const maxSteeringAngle = 0.5; // Radians
            const steeringAngle = steeringInput * maxSteeringAngle;

            // 1. Calculate Cornering Force (initiates the turn)
            // Slip angle is the difference between where the wheels are pointing and where the car is going.
            const slipAngle = Math.atan2(lateralVelocity, Math.abs(forwardVelocity)) - steeringAngle * Math.sign(forwardVelocity);
            let corneringForce = -this.corneringStiffness * slipAngle;

            const maxCorneringForce = normalForce * 1.2; // Max cornering force related to normal force
            corneringForce = Math.max(-maxCorneringForce, Math.min(corneringForce, maxCorneringForce));
            forces.lateral += corneringForce;

            // 2. Calculate Torque from Cornering Force
            const wheelbase = 2.8; // Effective distance between front and rear axles
            let torque = corneringForce * wheelbase * 0.5; // Simplified: force applied at front axle
            
            // Adjust torque based on speed to simulate understeer/oversteer characteristics
            const speedFactorForTorque = 1.0 - Math.min(1, (speed / this.maxSpeed) * 0.7);
            torque *= speedFactorForTorque;

            const maxTorque = this.momentOfInertia * 2.5; // Max rotational acceleration cap
            forces.torque += Math.max(-maxTorque, Math.min(torque, maxTorque));
        }

        // 3. Tire Grip (Corrective force against lateral slip, always active if there's lateral velocity)
        if (Math.abs(lateralVelocity) > 0.01) {
            const frictionMultiplier = this.isOnRoad ? 1.0 : (1.0 / this.offRoadFrictionMultiplier); // Off-road reduces grip
            
            // Grip force is stronger when lateral velocity is high relative to forward velocity (car is sliding)
            // And also stronger at lower absolute speeds (more control during slow slides)
            const gripFactor = Math.tanh(Math.abs(lateralVelocity) / (Math.abs(forwardVelocity) + 1.0)) * (1.0 - Math.min(1, speed / (this.maxSpeed * 0.5)));
            
            let gripForceMagnitude = this.tireGrip * normalForce * frictionMultiplier * gripFactor;
            
            // Ensure grip force doesn't exceed what's physically plausible (e.g., related to cornering force limits)
            const maxPossibleGrip = normalForce * this.tireGrip * frictionMultiplier; 
            gripForceMagnitude = Math.min(gripForceMagnitude, maxPossibleGrip);

            // Apply force opposing the lateral velocity
            forces.lateral -= Math.sign(lateralVelocity) * gripForceMagnitude;

            if (!this.isOnRoad) {
                // console.log(`OFF-ROAD: Reduced grip. Multiplier: ${frictionMultiplier.toFixed(2)}, Grip Force: ${(Math.sign(lateralVelocity) * gripForceMagnitude).toFixed(0)}`);
            }
        }        
        // Removed old lateral friction and simplified torque steering logic
        // The new steering model combines cornering force, torque, and a separate tire grip mechanism.

        return forces;
    }

    applyForces(forces, deltaTime) {
        // Get car's rotation (yaw)
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

        // --- Grip-based velocity adjustment ---
        // This part directly nudges the velocity vector towards the car's orientation based on tireGrip.
        // It's a more direct way to implement the idea that tires want to follow the car's direction.
        if (Math.abs(this.getSpeed()) > 0.1) { // Only apply if moving
            const carAngle = this.object.rotation.y;
            const carDirection = new THREE.Vector2(Math.sin(carAngle), Math.cos(carAngle)); // Forward vector of the car

            // Current velocity direction
            let currentVelocityVec = new THREE.Vector2(this._velocity.x, this._velocity.y);
            const speed = currentVelocityVec.length();
            if (speed < 0.01) return; // Avoid issues with zero speed
            // currentVelocityVec.normalize(); // No, we need the actual velocity for lerping

            // Target velocity direction (aligned with car)
            const targetVelocityVec = carDirection.multiplyScalar(speed);

            // Interpolate current velocity towards target velocity based on tireGrip and deltaTime
            // A higher tireGrip means we move closer to the targetVelocityVec each frame.
            const gripInfluence = Math.min(this.tireGrip * (deltaTime / (1.0/60.0)), 1.0); // Normalize grip influence by typical frame time, cap at 1
            
            const newVelocityX = currentVelocityVec.x + (targetVelocityVec.x - currentVelocityVec.x) * gripInfluence;
            const newVelocityY = currentVelocityVec.y + (targetVelocityVec.y - currentVelocityVec.y) * gripInfluence;
            
            // Dampen the change if it's too aggressive, especially at high speeds or high grip
            // This prevents overly snappy corrections.
            const maxChange = speed * 0.5 * gripInfluence; // Allow up to 50% of speed change per update based on grip
            
            const dVx = newVelocityX - this._velocity.x;
            const dVy = newVelocityY - this._velocity.y;
            const changeMag = Math.sqrt(dVx*dVx + dVy*dVy);

            if (changeMag > maxChange) {
                this._velocity.x += (dVx / changeMag) * maxChange;
                this._velocity.y += (dVy / changeMag) * maxChange;
            } else {
                this._velocity.x = newVelocityX;
                this._velocity.y = newVelocityY;
            }
        }
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
    setRoadData(roadData) { // Renamed from setRoadBounds and takes structured data
        if (!roadData) {
            console.warn("Car: setRoadData called with no data.");
            this.roadMesh = null;
            this.roadBounds = [];
            return;
        }

        this.roadMesh = roadData.roadMesh || null;
        this.roadBounds = roadData.roadBounds || [];

        console.log(`Car: Road detection setup - Road Mesh ${this.roadMesh ? 'FOUND' : 'NOT FOUND'}. Bounds count: ${this.roadBounds.length}`);
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

    // Create headlights for the loaded car model
    createHeadlights() {
        this.headlights = [];
        this.headlightHelpers = [];

        if (!this.mainBodyMesh) {
            console.warn("Main body mesh not found for headlight positioning. Headlights will not be created.");
            return;
        }

        // Bounding box of the unscaled main body part
        const modelBox = new THREE.Box3().setFromObject(this.mainBodyMesh);
        
        const carScale = this.modelScale.x; // Assuming uniform scaling for simplicity in positioning

        // Dimensions from the original model, to be scaled
        const modelWidth = modelBox.max.x - modelBox.min.x;
        const modelHeight = modelBox.max.y - modelBox.min.y;
        const modelFrontZ = modelBox.max.z; // Furthest Z point of the model part
        const modelMinY = modelBox.min.y;

        // Scaled positions for headlights
        // Place them slightly wider than the narrowest part of the car, and at a reasonable height
        const lightXOffset = modelWidth * 0.30 * carScale; 
        const lightYPos = (modelMinY + modelHeight * 0.65) * carScale; // 65% height of the main body
        const lightZPos = (modelFrontZ + 0.05 / carScale) * carScale; // Positioned 0.05 units *in model space* ahead of the car front

        const targetZPos = (modelFrontZ + 20 / carScale) * carScale; // Target 20 units *in model space* ahead
        const targetYOffset = -0.002; // Target slightly lower

        const commonLightParams = {
            color: 0xffffe0, // Warm white
            intensity: 500, // Adjusted for small scale
            distance: 15,    // Effective range in world units (e.g., 60 model units if scale is 0.01)
            angle: Math.PI / 5, // Approx 25 degrees cone
            penumbra: 0.4,   // Softer edge
            decay: 0.5       // More realistic falloff
        };
        
        console.log(`Creating headlights. Car scale: ${carScale}`);
        console.log(`Calculated light positions: X_offset=${lightXOffset.toFixed(3)}, Y=${lightYPos.toFixed(3)}, Z=${lightZPos.toFixed(3)}`);
        console.log(`Calculated target Z: ${targetZPos.toFixed(3)}`);


        // Left Headlight
        const leftHeadlight = this.createSpotlight(commonLightParams);
        leftHeadlight.position.set(-lightXOffset, lightYPos, lightZPos);
        leftHeadlight.target.position.set(-lightXOffset * 0.5, lightYPos + targetYOffset, targetZPos);
        this.object.add(leftHeadlight);
        this.object.add(leftHeadlight.target);
        this.headlights.push(leftHeadlight);

        /* if (context.scene) {
            const leftHelper = new THREE.SpotLightHelper(leftHeadlight);
            context.scene.add(leftHelper);
            this.headlightHelpers.push(leftHelper);
        } */

        // Right Headlight
        const rightHeadlight = this.createSpotlight(commonLightParams);
        rightHeadlight.position.set(lightXOffset, lightYPos, lightZPos);
        rightHeadlight.target.position.set(lightXOffset * 0.5, lightYPos + targetYOffset, targetZPos);
        this.object.add(rightHeadlight);
        this.object.add(rightHeadlight.target);
        this.headlights.push(rightHeadlight);

        /* if (context.scene) {
            const rightHelper = new THREE.SpotLightHelper(rightHeadlight);
            context.scene.add(rightHelper);
            this.headlightHelpers.push(rightHelper);
        } */
        
        console.log(`Headlights created: ${this.headlights.length}, Helpers: ${this.headlightHelpers.length}`);
        this.headlights.forEach((light, index) => {
            console.log(`Headlight ${index} position:`, light.position);
            console.log(`Headlight ${index} target position:`, light.target.position);
        });


        // Ensure headlights are initially set according to this.headlightsOn
        if (this.headlightsOn) {
            this.turnOnHeadlights();
        } else {
            this.turnOffHeadlights();
        }
    }

    // Helper to create a spotlight with appropriate properties
    createSpotlight(params) {
        const spotlight = new THREE.SpotLight(
            params.color,
            params.intensity,
            params.distance,
            params.angle,
            params.penumbra,
            params.decay
        );
        spotlight.castShadow = true; // Enable shadows for headlights
        spotlight.shadow.mapSize.width = 512; // Smaller shadow map for performance
        spotlight.shadow.mapSize.height = 512;
        spotlight.shadow.camera.near = 0.01; // Adjusted for small scale
        spotlight.shadow.camera.far = params.distance || 1; // Match light distance
        spotlight.shadow.bias = -0.0005; // Fine-tune to prevent self-shadowing or gaps
        
        return spotlight;
    }// Turn on headlights
    turnOnHeadlights() {
        this.headlights.forEach(light => light.visible = true);
        this.headlightsOn = true; // Ensure the state variable is also true
        if (this.headlights.length > 0) {
            console.log("Headlights turned ON - Intensity:", this.headlights[0].intensity);
        } else {
            console.log("Headlights turned ON (no lights initialized yet)");
        }
    }

    // Turn off headlights
    turnOffHeadlights() {
        this.headlights.forEach(light => light.visible = false);
        this.headlightsOn = false; // Ensure the state variable is also false
        console.log("Headlights turned OFF");
    }

    // NEW: Method to check time of day and automatically control headlights
    checkAutoHeadlights() {
        // If we have a reference to the time of day entity
        if (context && this.timeOfDay) { // Check manual toggle
            // console.log("Checking auto headlights based on time of day...");
            const hour = this.timeOfDay.getCurrentHour();
            
            // Turn on headlights automatically between 6PM (18) and 6AM (6)
            const isNighttime = (hour >= 18 || hour < 6); // Corrected to < 6 for morning
            
            if (isNighttime && !this.headlightsOn) {
                this.turnOnHeadlights();
            } else if (!isNighttime && this.headlightsOn) {
                this.turnOffHeadlights();
            }
        }
    }

    // Toggle headlights on/off
    toggleHeadlights() {
        this.manuallyToggledHeadlights = true; // Mark that headlights have been manually controlled
        
        this.headlightsOn = !this.headlightsOn;
        
        if (this.headlightsOn) {
            this.turnOnHeadlights();
        } else {
            this.turnOffHeadlights();
        }
    }
}

