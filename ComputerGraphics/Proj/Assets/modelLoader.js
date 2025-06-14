// Model loader for PseudoEngine
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Entity } from '../entity.js';

// Base class for GLTF model entities
export class GLTFModel extends Entity {
    constructor(name, modelPath, options = {}) {
        super(name);
        this.modelPath = modelPath;        this.isLoaded = false;
        this.options = {
            position: options.position || new THREE.Vector3(0, 0, 0),
            rotation: options.rotation || new THREE.Euler(0, 0, 0),
            scale: options.scale || new THREE.Vector3(1, 1, 1),
            castShadow: options.castShadow !== undefined ? options.castShadow : true,
            receiveShadow: options.receiveShadow !== undefined ? options.receiveShadow : true,
            onLoad: options.onLoad || null
        };}

    Init() {
        // We'll load the model in this method
        const loader = new GLTFLoader();
        
        loader.load(
            this.modelPath,
            (gltf) => {
                this.object = gltf.scene;
                this.isLoaded = true;
                
                // Apply position, rotation, scale
                this.position.copy(this.options.position);
                this.rotation.copy(this.options.rotation);
                this.scale.copy(this.options.scale);
                
                // Apply shadow settings to all meshes in the model
                this.object.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = this.options.castShadow;
                        node.receiveShadow = this.options.receiveShadow;
                    }                });
                
                // Call the onLoad callback if provided
                if (this.options.onLoad) {
                    this.options.onLoad(this);
                }
            },
            // Progress callback
            (xhr) => {
                console.log(`${this.name} loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
            },
            // Error callback
            (error) => {
                console.error(`Error loading model ${this.name}:`, error);
            }
        );
    }

    Start() {
        // Will be called from main.js after the entity is added to the scene
    }

    Update() {
        // Will be called every frame
    }
    
    // Clone the model (useful for instancing)
    clone(newName) {
        if (!this.isLoaded) {
            console.warn(`Cannot clone ${this.name} - model not loaded yet.`);
            return null;
        }
        
        // Create a new instance with the same model path and options
        const clonedModel = new GLTFModel(
            newName || `${this.name}_clone`, 
            this.modelPath, 
            this.options
        );
        
        // Clone the object
        clonedModel.object = this.object.clone();
        clonedModel.isLoaded = true;
        
        return clonedModel;
    }
}

// Specific model classes for the imported assets
export class CarModel extends GLTFModel {
    constructor(name, options = {}) {
        super(name, './Assets/models/car/scene.gltf', options);
        this.tag = 'car';
    }
}

export class RoadModel extends GLTFModel {
    constructor(name, options = {}) {
        super(name, './Assets/models/road/scene.gltf', options);
        this.tag = 'road';
    }
}

export class TreeModel extends GLTFModel {
    constructor(name, options = {}) {
        super(name, './Assets/models/tree/scene.gltf', options);
        this.tag = 'tree';
    }
}
