import * as THREE from 'three';
import { Entity } from '../entity.js';

// Inherit from Entity to create a pillar
export class Pillar extends Entity {
    constructor(name, radius = 1, height = 10) {
        super(name);
        this.tag = 'pillar';
        this.radius = radius;
        this.height = height;
    }

    Init() {
        // Create a cylinder mesh
        const geometry = new THREE.CylinderGeometry(
            this.radius,    // radiusTop
            this.radius,    // radiusBottom
            this.height,    // height
            32,             // radialSegments
            1,              // heightSegments
            false           // openEnded
        );
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc, // Light grey color
            roughness: 0.5,
            metalness: 0.1,
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position the bottom of the cylinder at y=0
        mesh.position.y = this.height / 2;
        
        this.object = mesh;
        this.object.castShadow = true;
        this.object.receiveShadow = true;
    }

    Start() {
        // Initialization code that runs when the pillar is first added to the scene
    }

    Update() {
        // Code that runs every frame
    }
}