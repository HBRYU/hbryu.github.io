import * as THREE from 'three';
import { Entity } from '../entity.js';

// Inherit from Entity to create a controllable box
export class Plane extends Entity {
    constructor(name, width = 10, height = 10) {
        // Pass null for object - we'll create it in Init()
        super(name);
        this.tag = 'groundPlane';
        this.width = width;  // Width of the plane
        this.height = height; // Height of the plane
    }

    Init() {
        // Create the mesh here instead of outside the class
        const geometry = new THREE.PlaneGeometry(this.width, this.height);  // width, height
        const material = new THREE.MeshStandardMaterial({
            color: 0xd1cdb6,
            roughness: 0.8,
            metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2; // Rotate to lie on XZ plane
        this.object = mesh;
        this.object.castShadow = false;
        this.object.receiveShadow = true;
        material.side = THREE.DoubleSide; 
    }

    Start() {

    }

    Update() {

    }
}