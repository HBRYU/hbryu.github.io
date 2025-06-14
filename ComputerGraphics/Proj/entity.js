import * as THREE from 'three';

export class Entity {
    constructor(name) {
        this.name = name;
        this.tag = null;
        this.transform = null;
        // this.context = null;  // will be set in main.js -> deprecated
        this._position = new THREE.Vector3(0, 0, 0);
        this._rotation = new THREE.Euler(0, 0, 0);
        this._scale = new THREE.Vector3(1, 1, 1);
        this.object = null;  // will be set in Init()
    }

    get object() { return this._object; }

    set object(obj) {
        // Accept null values
        if (obj === null) {
            this._object = null;
            return;
        }
        
        // Accept both Mesh and Object3D
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Object3D) {
            this._object = obj;
            this._object.name = this.name; // Set the name for the object
        }
    }

    get position() { 
        if (this._object && this._object.position) {
            return this._object.position;
        }
        return this._position;
    }
    
    get rotation() { 
        if (this._object && this._object.rotation) {
            return this._object.rotation;
        }
        return this._rotation;
    }
    
    get scale() { 
        if (this._object && this._object.scale) {
            return this._object.scale;
        }
        return this._scale;
    }
    
    get transform() {
        // Will create a new object. Don't use it in a loop
        // or it will create a lot of garbage
        return {
            position: this.position,
            rotation: this.rotation,
            scale: this.scale
        };
    }
    
    set transform(value) {
        if (!value) return; // Ignore null or undefined
        const { position, rotation, scale } = value;
        
        if (position) {
            if (this._object && this._object.position) {
                this._object.position.set(position.x, position.y, position.z);
            } else {
                this._position.set(position.x, position.y, position.z);
            }
        }
        
        if (rotation) {
            if (this._object && this._object.rotation) {
                this._object.rotation.set(rotation.x, rotation.y, rotation.z);
            } else {
                this._rotation.set(rotation.x, rotation.y, rotation.z);
            }
        }
        
        if (scale) {
            if (this._object && this._object.scale) {
                this._object.scale.set(scale.x, scale.y, scale.z);
            } else {
                this._scale.set(scale.x, scale.y, scale.z);
            }
        }
    }

    getName() {
        return this.name;
    }

    Init() {
        // Initialization logic for the entity
        // Create the object and add it to the scene
        // Can either be implemented here or be empty, in which case
        // This is where you would typically set up the mesh, materials, etc.

        // Base implementation: do nothing or throw to enforce override
        // throw new Error('Init() must be implemented by subclass');
    }

    Start() {
        // Start logic for the entity
        // Works with the assumption that the mesh is already added to the scene

        // Base implementation: do nothing or throw to enforce override
        // throw new Error('Start() must be implemented by subclass');
    }

    Update() {
        // Base implementation: do nothing or throw to enforce override
        // throw new Error('Update() must be implemented by subclass');
    }
}