import * as THREE from 'three';
import { context } from '../init.js';

export class GrassInstancer {
  constructor(jsonPath, roadLoader, countPerType = 1000, areaSize = 200) {
    this.jsonPath = jsonPath;
    this.roadLoader = roadLoader;
    this.countPerType = countPerType;
    this.areaSize = areaSize;
    this.instancedList = [];
  }

  async Init() {
    try {
      const { scene } = context;
      const loader = new THREE.ObjectLoader();
      const data = await fetch(this.jsonPath).then(r => r.json());
      
      if (!data) {
        console.error('Failed to load grass data');
        return;
      }
      
      const grassGroup = loader.parse(data);

      // Find all meshes recursively in the loaded group
      const meshes = [];
      grassGroup.traverse((child) => {
        if (child.isMesh && child.geometry) {
          meshes.push(child);
        }
      });

      console.log(`Found ${meshes.length} grass meshes`);

      if (meshes.length === 0) {
        console.warn('No valid grass meshes found');
        return;
      }

      // Create one InstancedMesh per grass mesh
      meshes.forEach((mesh, index) => {
        try {
          // Ensure geometry exists and is valid
          if (!mesh.geometry) {
            console.warn(`Skipping mesh ${index} - no geometry`);
            return;
          }

          // Clone the material safely
          let material;
          if (mesh.material && mesh.material.map) {
            // use the existing texture map, but ensure correct encoding + alpha
            material = mesh.material.clone();
            material.map.encoding     = THREE.sRGBEncoding;
            material.transparent      = true;
            material.alphaTest        = 0.5;
            material.side             = THREE.DoubleSide;
            material.needsUpdate      = true;
          } else {
            // fallback to a simple green Lambert so it actually shows up
            material = new THREE.MeshLambertMaterial({
              color:       0xffffff,
              side:        THREE.DoubleSide
            });
          }

          const inst = new THREE.InstancedMesh(
            mesh.geometry,
            material,
            this.countPerType
          );
          
          inst.name = `GrassInstance_${index}`;
          inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          inst.castShadow = true;
          inst.receiveShadow = true;
          
          // Initialize all instance matrices to identity (invisible/zero scale initially)
          const dummy = new THREE.Object3D();
          for (let i = 0; i < this.countPerType; i++) {
            dummy.position.set(0, -1000, 0); // Place far underground initially
            dummy.scale.set(0.001, 0.001, 0.001); // Nearly invisible scale
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
          }
          inst.instanceMatrix.needsUpdate = true;
          
          scene.add(inst);
          this.instancedList.push(inst);
          
          console.log(`Created instanced mesh: ${mesh.name || `Mesh_${index}`}`);
        } catch (error) {
          console.error(`Error creating instanced mesh ${index}:`, error);
        }
      });

      // Only scatter if we successfully created instances
      if (this.instancedList.length > 0) {
        this._scatter();
      }
    } catch (error) {
      console.error('GrassInstancer Init failed:', error);
    }
  }

  _scatter() {
    const dummy = new THREE.Object3D();
    const S = this.areaSize;

    console.log(`Scattering grass across ${S}x${S} area...`);

    this.instancedList.forEach((inst, meshIndex) => {
      let placed = 0;
      
      for (let i = 0; i < this.countPerType; i++) {
        const x = THREE.MathUtils.randFloatSpread(S);
        const z = THREE.MathUtils.randFloatSpread(S);

        // Place grass instance at ground level (no origin-skip logic)
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const s = THREE.MathUtils.randFloat(0.8, 1.2);
        dummy.scale.set(s, s, s);

        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        placed++;
      }
      
      inst.instanceMatrix.needsUpdate = true;
      console.log(`Placed ${placed} instances of grass mesh ${meshIndex}`);
    });
  }
}