// Road loader for PseudoEngine - loads scene.glb file
import * as THREE from 'three';
import { Entity } from '../entity.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class RoadLoader extends Entity {
    constructor(name, glbPath, scene = null) {
        super(name);
        this.glbPath = glbPath;
        this.scene = scene;
        this.isLoaded = false;
        this.startPosition = null;
        this.finishPosition = null;
        this.trackConfig = null;
        this.textureLoader = new THREE.TextureLoader();
        this.loadedTextures = new Map();
        this.roadMeshForCar = null; // Added for car's raycasting
        this.roadBoundsForCar = []; // Added for car's fallback bounds
    }    // Replace both Init() and loadTrackConfig() with one async Init():
    async Init() {
    try {
        // Load GLB file with GLTFLoader (not fetch)
        const gltfLoader = new GLTFLoader();
        const gltf = await gltfLoader.loadAsync(this.glbPath);

        // Build the scene from gltf.scene (materials/textures already embedded)
        this.loadScene(gltf.scene);
        this.isLoaded = true; // Mark as loaded
        console.log('RoadLoader: GLB Scene loaded successfully');
        if (this.context && this.context.ui && typeof this.context.ui.updateRoadStatusMessage === 'function') {
            this.context.ui.updateRoadStatusMessage("Road Status: Ready");
        }
    } catch (err) {
        console.error('RoadLoader.Init failed:', err);
        this.isLoaded = false; // Ensure isLoaded is false on error
        if (this.context && this.context.ui && typeof this.context.ui.updateRoadStatusMessage === 'function') {
            this.context.ui.updateRoadStatusMessage("Road Status: Error loading road");
        }
    }
}

    // Pre-load textures from the new TrackTexture3.json format
    async preloadTexturesFromConfig() {
        if (!this.trackConfig?.textures) return;
        const texturePromises = this.trackConfig.textures.map((textureData) => {
            return new Promise((resolve) => {
                // Find corresponding image data
                const imageData = this.trackConfig.images?.find(img => img.uuid === textureData.image);

                if (imageData && imageData.url) {
                    this.textureLoader.load(imageData.url, (texture) => {
                        // Apply texture properties from config
                        texture.wrapS = textureData.wrap ? textureData.wrap[0] : THREE.RepeatWrapping;
                        texture.wrapT = textureData.wrap ? textureData.wrap[1] : THREE.RepeatWrapping;
                        texture.repeat.set(textureData.repeat[0], textureData.repeat[1]);
                        texture.offset.set(textureData.offset[0], textureData.offset[1]);
                        texture.rotation = textureData.rotation;
                        texture.flipY = textureData.flipY;
                        texture.generateMipmaps = textureData.generateMipmaps;
                        texture.minFilter = textureData.minFilter;
                        texture.magFilter = textureData.magFilter;
                        texture.anisotropy = textureData.anisotropy;

                        this.loadedTextures.set(textureData.uuid, texture);
                        console.log(`Loaded texture: ${textureData.name || textureData.uuid}`);
                        resolve();
                    }, undefined, () => {
                        console.warn(`Failed to load texture: ${textureData.name || textureData.uuid}`);
                        resolve();
                    });
                } else {
                    console.warn(`No image data found for texture: ${textureData.uuid}`);
                    resolve();
                }
            });
        });

        await Promise.all(texturePromises);
    }

    // Apply textures using the new configuration format
    applyTexturesFromConfig() {
        if (!this.trackConfig?.materials || !this.object) {
            console.log('RoadLoader: Cannot apply textures: missing materials config or object');
            return;
        }

        console.log('RoadLoader: Applying textures from Tree_size_check_2.json...');
        let textureCount = 0;

        this.object.traverse((child) => {
            if (child.isMesh && child.material) {
                // Find material configuration by matching material properties or mesh name
                const materialConfig = this.findMaterialConfigForMesh(child);
                if (materialConfig) {
                    console.log(`RoadLoader: Applying material config to mesh: ${child.name}`, materialConfig);
                    this.applyMaterialConfig(child, materialConfig);
                    textureCount++;
                } else {
                    console.log(`RoadLoader: No material configuration found for mesh: ${child.name}`);
                }
            }
        });

        console.log(`RoadLoader: Applied material configurations to ${textureCount} meshes`);
    }

    // Find appropriate material configuration for a mesh
    findMaterialConfigForMesh(mesh) {
        if (!this.trackConfig?.materials) return null;

        // Try to match by mesh name first
        if (mesh.name === 'Plane') {
            // Look for materials with texture maps (likely the road surface)
            return this.trackConfig.materials.find(mat => mat.map);
        }

        // For Start/Finish markers, use materials without textures
        if (mesh.name === 'Start' || mesh.name === 'Finish') {
            return this.trackConfig.materials.find(mat => !mat.map);
        }

        // Default fallback
        return this.trackConfig.materials[0];
    }

    // Apply material configuration to a mesh
    applyMaterialConfig(mesh, materialConfig) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material) => {
            // Apply basic material properties
            if (materialConfig.color !== undefined) {
                material.color.setHex(materialConfig.color);
            }
            if (materialConfig.roughness !== undefined) {
                material.roughness = materialConfig.roughness;
            }
            if (materialConfig.metalness !== undefined) {
                material.metalness = materialConfig.metalness;
            }
            if (materialConfig.emissive !== undefined) {
                material.emissive.setHex(materialConfig.emissive);
            }

            // Apply texture map if specified
            if (materialConfig.map && this.loadedTextures.has(materialConfig.map)) {
                material.map = this.loadedTextures.get(materialConfig.map);
                console.log(`Applied texture map to material: ${materialConfig.name || 'unnamed'}`);
            }

            // Apply side rendering if specified
            if (materialConfig.side !== undefined) {
                material.side = materialConfig.side;
            }            material.needsUpdate = true;
        });
    }

    loadScene(gltfScene) {
        // Use the GLTF scene directly instead of ObjectLoader
        const loadedScene = gltfScene;

        this.object = new THREE.Group();
        this.object.name = this.name;
        this.roadMeshForCar = null; // Initialize here
        this.roadBoundsForCar = []; // Initialize here

        // Force world matrices to be correct
        loadedScene.updateMatrixWorld(true);

        loadedScene.traverse((child) => {
            // if (!child.isMesh) return;

            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            child.getWorldQuaternion(worldQuat);
            child.getWorldScale(worldScale);


            // START / FINISH: just align + record, do NOT add to scene
            if (child.name === 'Start' || child.name === 'Finish') {
                const m = child.clone();
                this.alignMeshToGround(m);
                const pos = worldPos.clone();
                pos.y = 0;
                if (child.name === 'Start') {
                    this.startPosition = pos;
                    console.log('Found Start at', pos);
                } else {
                    this.finishPosition = pos;
                    console.log('Found Finish at', pos);
                }
                return;
            }

            // all other road pieces: clone, align, style, add
            const mesh = child.clone();
            mesh.position.copy(worldPos);
            mesh.quaternion.copy(worldQuat);
            mesh.scale.copy(worldScale);
            if(child.name === 'Plane') {
                this.alignMeshToGround(mesh);
                this.roadMeshForCar = mesh; // Assign to the new property
                console.log("plane assigned to roadMeshForCar");
            }
            else if(child.name.toLowerCase().includes('rock')) {
                // align road pieces to ground
                mesh.castShadow = true;
                mesh.position.y = 0; // align rock to ground
            }
            // else if(child.name.includes('Material2_17')){
            //     // Add downward pointing spot light
            //     const spotLight = new THREE.SpotLight(0xffffff, 5);
            //     spotLight.position.copy(child.position);
            //     spotLight.target.position.copy(child.position);
            //     spotLight.target.position.y -= 10; // Point downward
            //     spotLight.angle = Math.PI / 6; // 30 degree cone
            //     spotLight.penumbra = 0.1; // soft edges
            //     spotLight.decay = 2; // realistic light falloff
            //     spotLight.distance = 10; // light range
            //     spotLight.castShadow = true;
                
            //     // Add both the light and its target to the scene
            //     this.object.add(spotLight);
            //     this.object.add(spotLight.target);
            //     console.log("Added spot light to Material2_17");
            // }
            else{
                //set material to caset shadow
                mesh.castShadow = true;
            }
            // … your existing per‐piece material/shadow logic …
            this.object.add(mesh);
            
            // Populate roadBoundsForCar for fallback detection, excluding Start/Finish
            if (child.isMesh && child.name !== 'Start' && child.name !== 'Finish' && child.name !== 'Plane') {
                const box = new THREE.Box3().setFromObject(mesh); // Use the cloned and transformed mesh
                this.roadBoundsForCar.push({
                    min: box.min,
                    max: box.max,
                    name: child.name
                });
            }
        });

        // now we’re loaded
        this.isLoaded = true;
        this.applyTexturesFromConfig();
        if (this.scene) this.scene.add(this.object);

        if (!this.startPosition) throw new Error('RoadLoader: missing Start marker');
        if (!this.finishPosition) throw new Error('RoadLoader: missing Finish marker');
    }

    // Method to align mesh vertices to y=0
    alignMeshToGround(mesh) {
        if (!mesh.geometry) return;

        const geometry = mesh.geometry;

        // Handle BufferGeometry
        if (geometry.isBufferGeometry) {
            const positionAttribute = geometry.getAttribute('position');
            if (positionAttribute) {
                console.log(`Aligning ${positionAttribute.count} vertices to y=0 for mesh: ${mesh.name}`);

                // Get the position array
                const positions = positionAttribute.array;

                // Set all Y coordinates to 0 (every 3rd element starting from index 1)
                for (let i = 1; i < positions.length; i += 3) {
                    positions[i] = 0;
                }

                // Mark the attribute as needing update
                positionAttribute.needsUpdate = true;

                // Recompute normals and bounding sphere
                geometry.computeVertexNormals();
                geometry.computeBoundingSphere();

                console.log(`Aligned mesh ${mesh.name} to ground plane`);
            }
        }
        // Handle legacy Geometry (if any)
        else if (geometry.vertices) {
            console.log(`Aligning ${geometry.vertices.length} vertices to y=0 for legacy geometry: ${mesh.name}`);

            geometry.vertices.forEach(vertex => {
                vertex.y = 0;
            });

            geometry.verticesNeedUpdate = true;
            geometry.computeFaceNormals();
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
        }

        // Also align the mesh position to ensure it's on the ground
        mesh.position.y = 0;
    }

    getStartPosition() {
        return this.startPosition ? this.startPosition.clone() : new THREE.Vector3(0, 0, 0);
    }

    getFinishPosition() {
        return this.finishPosition ? this.finishPosition.clone() : new THREE.Vector3(0, 0, 0);
    }

    // NEW: Method to provide road geometry for the car
    getRoadGeometry() {
        if (!this.isLoaded) {
            console.warn("RoadLoader: Attempted to get road geometry before loading complete.");
            return null;
        }
        return {
            roadMesh: this.roadMeshForCar,
            roadBounds: this.roadBoundsForCar
        };
    }
}
