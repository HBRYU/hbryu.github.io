import * as THREE from 'three';
import { Entity } from '../entity.js';
import { context } from '../init.js';

/**
 * TimeOfDay manages a day-night cycle with smooth light transitions.
 * cycleDuration (seconds) maps to 24 in-game hours.
 * keyframes: { [hour: number]: { ambient: {color, intensity}, directional: {color, intensity, position} } }
 */
export class TimeOfDay extends Entity {
  constructor(name, scene, options = {}) {
    super(name);
    this.scene   = scene;
    this.options = options;
    const {
      cycleDuration    = 120,
      keyframes        = {},
      radius           = 100,
      shadowFrustumSize= 100,
      // allow customizing start hour; default to 6AM
      initialHour      = 6
    } = options;

    this.cycleDuration     = cycleDuration;
    this.keyframes         = keyframes;
    this.radius            = radius;
    this.shadowFrustumSize = shadowFrustumSize;
    // start elapsed time so that the cycle begins at initialHour
    this.elapsed = (initialHour / 24) * this.cycleDuration;
  }

  Start() {
    // Initialize camera reference from context (now available)
    this.camera = context.camera;

    // Create lights with shadow support
    this.ambientLight = new THREE.AmbientLight();
    this.sunLight = new THREE.DirectionalLight();

    // Configure sun shadows
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.radius = 8;
    this._setupShadowCamera(this.sunLight.shadow.camera, this.shadowFrustumSize);

    // Create targets for lights to follow camera
    this.sunTarget = new THREE.Object3D();
    this.sunLight.target = this.sunTarget;

    this.scene.add(this.ambientLight, this.sunLight, this.sunTarget);

    // Enable shadows on all meshes in scene
    this._enableShadowsOnMeshes();
  }

  // Configure orthographic shadow camera
  _setupShadowCamera(shadowCam, frustumSize) {
    shadowCam.near = 0.5;
    shadowCam.far = 500;
    shadowCam.left = -frustumSize;
    shadowCam.right = frustumSize;
    shadowCam.top = frustumSize;
    shadowCam.bottom = -frustumSize;
    shadowCam.updateProjectionMatrix();
  }

  // Enable shadows on all meshes in the scene
  _enableShadowsOnMeshes() {
    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  // Update shadow camera positions to follow game camera
  _updateShadowCameraPosition() {
    const cameraPos = this.camera.position;
    const cameraHeight = Math.abs(cameraPos.y);
    const dynamicSize = Math.max(this.shadowFrustumSize, cameraHeight * 2);

    // Update sun light target and shadow camera
    this.sunTarget.position.set(cameraPos.x, 0, cameraPos.z);
    this.sunTarget.updateMatrixWorld();

    const sunCam = this.sunLight.shadow.camera;
    sunCam.left = -dynamicSize;
    sunCam.right = dynamicSize;
    sunCam.top = dynamicSize;
    sunCam.bottom = -dynamicSize;
    sunCam.far = dynamicSize * 3;
    sunCam.updateProjectionMatrix();
  }

  Update(deltaTime) {
    // Skip if lights haven't been created yet
    if (!this.sunLight || !this.ambientLight) return;

    // Advance time
    this.elapsed = (this.elapsed + deltaTime) % this.cycleDuration;
    const currentTime = this.elapsed / this.cycleDuration * 24; // current time in hours [0,24)

    // Update camera position for shadows
    this._updateShadowCameraPosition();

    // grab, sort and de-duplicate your key times
    const times = Object.keys(this.keyframes)
      .map(t => parseFloat(t))
      .sort((a,b) => a - b);

    // find the interval [t0→t1) that contains currentTime,
    // treating the last→first as 24h wrap.
    let t0, t1;
    for (let i = 0; i < times.length; i++) {
      const a = times[i];
      const b = times[(i + 1) % times.length];
      // if we’re at the last entry, bump b by +24
      const bWrapped = (i + 1 === times.length) ? b + 24 : b;
      if (
        // normal case
        (currentTime >= a && currentTime < bWrapped) ||
        // wrap-around case when a> b
        (i + 1 === times.length && (currentTime >= a || currentTime < b))
      ) {
        t0 = a;
        t1 = bWrapped;
        break;
      }
    }

    // fetch keyframes
    const kf0 = this.keyframes[t0 % 24];
    const kf1 = this.keyframes[t1 % 24];

    // compute local t [0,1]
    const frac = ((currentTime - t0 + 24) % 24) / (t1 - t0);

    // now lerp your ambient/directional settings
    this.ambientLight.color.lerpColors(
      new THREE.Color(kf0.ambient.color),
      new THREE.Color(kf1.ambient.color),
      frac
    );
    this.ambientLight.intensity = THREE.MathUtils.lerp(
      kf0.ambient.intensity,
      kf1.ambient.intensity,
      frac
    );
    this.sunLight.color.lerpColors(
      new THREE.Color(kf0.directional.color),
      new THREE.Color(kf1.directional.color),
      frac
    );
    this.sunLight.intensity = THREE.MathUtils.lerp(
      kf0.directional.intensity,
      kf1.directional.intensity,
      frac
    );

    // Position sun relative to camera
    const cameraPos = this.camera.position;
    const angle = currentTime / 24 * Math.PI * 2 - Math.PI / 2;
    const sx = cameraPos.x + Math.cos(angle) * this.radius;
    const sy = Math.sin(angle) * this.radius;
    const sz = cameraPos.z;
    this.sunLight.position.set(sx, sy, sz);

    // console.log(`Time: ${currentTime.toFixed(2)}h, Ambient Intensity: ${this.ambientLight.intensity.toFixed(2)}, Sun Intensity: ${this.sunLight.intensity.toFixed(2)}`);

    // Update UI with current time
    if (window.ui && window.ui.updateTimeOfDay) {
      const hours = Math.floor(currentTime);
      const minutes = Math.floor((currentTime % 1) * 60);
      window.ui.updateTimeOfDay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    }
  }

  _interpolate(prop, t) {
    const hours = Object.keys(this.keyframes).map(h => parseFloat(h)).sort((a,b)=>a-b);
    // Find surrounding keyframes
    let h0 = hours[0], h1 = hours[hours.length-1];
    for (let i = 0; i < hours.length-1; i++) {
      if (t >= hours[i] && t <= hours[i+1]) {
        h0 = hours[i];
        h1 = hours[i+1];
        break;
      }
    }
    const k0 = this.keyframes[h0];
    const k1 = this.keyframes[h1];
    const span = h1 - h0;
    const alpha = span > 0 ? (t - h0) / span : 0;
    // Color lerp
    const c0 = new THREE.Color(k0[prop].color);
    const c1 = new THREE.Color(k1[prop].color);
    const c = c0.lerp(c1, alpha);
    // Intensity lerp
    const i0 = k0[prop].intensity;
    const i1 = k1[prop].intensity;
    const intensity = THREE.MathUtils.lerp(i0, i1, alpha);
    return { color: c.getHex(), intensity };
  }

  _sunIntensity(t, maxI) {
    if (t < 12) return maxI * (t / 12);
    if (t < 18) return THREE.MathUtils.lerp(this.keyframes[12].directional.intensity, this.keyframes[18].directional.intensity, (t - 12) / 6);
    return maxI * Math.max(0, (24 - t) / 6);
  }

  /**
   * Get the current in-game hour (0-23.99)
   * @returns {number} Current in-game hour
   */
  getCurrentHour() {
    const hourFraction = (this.elapsed / this.cycleDuration) * 24;
    return hourFraction % 24;
  }
}
