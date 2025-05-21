// ──────────────────────────────────────────────────────────────────────────────
//  Solar-System Demo with Switchable Cameras
// ──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

/* ── Scene ────────────────────────────────────────────────────────────────── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

/* ── Cameras ──────────────────────────────────────────────────────────────── */
const aspect       = window.innerWidth / window.innerHeight;
const perspCam     = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
perspCam.position.set(-3, 8, 60);
scene.add(perspCam);

const frustumSize  = 80;
const orthoCam     = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) /  2,
  frustumSize / 2,
  frustumSize / -2,
  0.1, 500
);
orthoCam.position.copy(perspCam.position);
scene.add(orthoCam);

let activeCamera = perspCam;   // handle used in controls and rendering

/* ── Renderer ─────────────────────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* ── Controls / Stats / GUI ───────────────────────────────────────────────── */
let orbitControls = new OrbitControls(activeCamera, renderer.domElement);
orbitControls.enableDamping = true;

const stats = new Stats();
document.body.appendChild(stats.dom);

const gui = new GUI();

/* ── Lights ───────────────────────────────────────────────────────────────── */
const pointLight = new THREE.PointLight(0xffffff, 2, 0);
pointLight.position.set(0, 0, 0);
pointLight.castShadow = true;
scene.add(pointLight);

const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(5, 12, 8);
dirLight.castShadow = true;
scene.add(dirLight);

/* ── Sun ──────────────────────────────────────────────────────────────────── */
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(10, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
scene.add(sun);

/* ── Planet Definitions ───────────────────────────────────────────────────── */
const textureLoader = new THREE.TextureLoader();
const planetData = [
  { name: 'Mercury', radius: 1.5, distance: 20, texture: 'Mercury.jpg', rotationSpeed: 0.02,  orbitSpeed: 0.02 },
  { name: 'Venus',   radius: 3,   distance: 35, texture: 'Venus.jpg',   rotationSpeed: 0.015, orbitSpeed: 0.015 },
  { name: 'Earth',   radius: 3.5, distance: 50, texture: 'Earth.jpg',   rotationSpeed: 0.01,  orbitSpeed: 0.01 },
  { name: 'Mars',    radius: 2.5, distance: 65, texture: 'Mars.jpg',    rotationSpeed: 0.008, orbitSpeed: 0.008 }
];

/* ── Planet Creation ──────────────────────────────────────────────────────── */
const planets = [];

planetData.forEach(data => {
  const material = new THREE.MeshStandardMaterial({
    map: textureLoader.load(data.texture),
    roughness: 0.8,
    metalness: 0.2
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(data.radius, 32, 32),
    material
  );
  mesh.position.x = data.distance;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pivot = new THREE.Object3D();
  pivot.add(mesh);
  scene.add(pivot);

  const control = { rotationSpeed: data.rotationSpeed, orbitSpeed: data.orbitSpeed };

  const folder = gui.addFolder(data.name);
  folder.add(control, 'rotationSpeed', 0, 0.05).name('Self Rotation');
  folder.add(control, 'orbitSpeed',    0, 0.05).name('Orbit Speed');
  folder.open();

  planets.push({ mesh, pivot, control });
});

/* ── Camera GUI Folder ────────────────────────────────────────────────────── */
const camParams = {
  currentType: 'Perspective',
  switchType: () => {
    activeCamera = (activeCamera === perspCam) ? orthoCam : perspCam;
    camParams.currentType = (activeCamera === perspCam) ? 'Perspective' : 'Orthographic';

    orbitControls.object = activeCamera;
    activeCamera.updateProjectionMatrix();
  }
};

const cameraFolder = gui.addFolder('Camera');
cameraFolder.add(camParams, 'switchType').name('Switch Camera Type');
cameraFolder.add(camParams, 'currentType').name('Current Camera').listen();
cameraFolder.open();

/* ── Resize Handling ─────────────────────────────────────────────────────── */
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;

  // perspective camera
  perspCam.aspect = aspect;
  perspCam.updateProjectionMatrix();

  // orthographic camera
  orthoCam.left   = (frustumSize * aspect) / -2;
  orthoCam.right  = (frustumSize * aspect) /  2;
  orthoCam.top    =  frustumSize / 2;
  orthoCam.bottom = -frustumSize / 2;
  orthoCam.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ── Animation Loop ───────────────────────────────────────────────────────── */
function animate() {
  requestAnimationFrame(animate);

  planets.forEach(p => {
    p.mesh.rotation.y  += p.control.rotationSpeed; // self-rotation
    p.pivot.rotation.y += p.control.orbitSpeed;    // revolution
  });

  orbitControls.update();
  stats.update();
  renderer.render(scene, activeCamera);
}

animate();
