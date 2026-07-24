import * as THREE from './three.module.js';
import steveUrl from './steve.png';
import alexUrl from './alex.png';
import creeperUrl from './creeper.png';
import endermanUrl from './enderman.png';
import grassUrl from './grass-top.png';
import dirtUrl from './dirt.png';
import grassSideUrl from './grass-side.png';

const CHARACTER_URLS = { steve: steveUrl, alex: alexUrl, creeper: creeperUrl, enderman: endermanUrl };
const CHARACTER_NAMES = new Set(Object.keys(CHARACTER_URLS));
const PIXEL_SCALE = 0.15;

const canvas = document.querySelector('#model');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.25, 14);
camera.lookAt(0, 0.25, 0);

scene.add(new THREE.HemisphereLight(0xc7e5ff, 0x152125, 3));
const sun = new THREE.DirectionalLight(0xffcc8f, 2.8);
sun.position.set(-4, 7, 7);
scene.add(sun);

const root = new THREE.Group();
const models = new THREE.Group();
root.position.y = -0.5;
root.add(models);
scene.add(root);

const geometryCache = new Map();
const materialCache = new WeakMap();
const imageCache = new Map();

const boxFaces = (u, v, width, height, depth) => [
  [u + depth + width, v + depth, depth, height],
  [u, v + depth, depth, height],
  [u + depth, v, width, depth],
  [u + depth + width, v, width, depth],
  [u + depth, v + depth, width, height],
  [u + depth + width + depth, v + depth, width, height],
];

const UV = {
  head: boxFaces(0, 0, 8, 8, 8),
  playerBody: boxFaces(16, 16, 8, 12, 4),
  playerArm: boxFaces(40, 16, 4, 12, 4),
  playerLeg: boxFaces(0, 16, 4, 12, 4),
  creeperLeg: boxFaces(0, 16, 4, 6, 4),
  endermanBody: boxFaces(32, 16, 8, 12, 4),
  endermanLimb: boxFaces(56, 0, 2, 30, 2),
};

function getGeometry(width, height, depth) {
  const key = `${width}/${height}/${depth}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(width, height, depth);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

function getPixelMaterial(image, x = 0, y = 0, width = 16, height = 16, tint = '') {
  let cache = materialCache.get(image);
  if (!cache) {
    cache = new Map();
    materialCache.set(image, cache);
  }

  const key = `${x}/${y}/${width}/${height}/${tint}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;
  const context = textureCanvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  if (tint) {
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = tint;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({ map: texture });
  cache.set(key, material);
  return material;
}

function addBox(parent, width, height, depth, x, y, material, z = 0) {
  const mesh = new THREE.Mesh(getGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addSkinBox(parent, width, height, depth, x, y, image, faces) {
  const materials = faces.map(([u, v, faceWidth, faceHeight]) => getPixelMaterial(image, u, v, faceWidth, faceHeight));
  return addBox(parent, width, height, depth, x, y, materials);
}

function createEndermanEyeMaterial() {
  const eyeCanvas = document.createElement('canvas');
  eyeCanvas.width = 8;
  eyeCanvas.height = 8;
  const context = eyeCanvas.getContext('2d');
  context.fillStyle = '#df7af0';
  for (const x of [0, 2, 5, 7]) context.fillRect(x, 4, 1, 1);
  context.fillStyle = '#bc18ec';
  for (const x of [1, 6]) context.fillRect(x, 4, 1, 1);

  const texture = new THREE.CanvasTexture(eyeCanvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, toneMapped: false });
}

const endermanEyeMaterial = createEndermanEyeMaterial();
const endermanEyeGeometry = new THREE.PlaneGeometry(1.2, 1.2);

function addEndermanEyes(parent) {
  const eyes = new THREE.Mesh(endermanEyeGeometry, endermanEyeMaterial);
  eyes.position.z = 0.607;
  parent.add(eyes);
}

function createPlayer(image, slim) {
  const group = new THREE.Group();
  const upperBody = new THREE.Group();
  const headPivot = new THREE.Group();
  group.add(upperBody);
  upperBody.add(headPivot);
  models.add(group);

  headPivot.position.y = 3.7;
  addSkinBox(headPivot, 2, 2, 2, 0, 0, image, UV.head);
  addSkinBox(upperBody, 2, 2.8, 1, 0, 1.3, image, UV.playerBody);

  const armWidth = slim ? 0.75 : 0.85;
  addSkinBox(upperBody, armWidth, 2.8, 0.9, -1.45, 1.35, image, UV.playerArm);
  addSkinBox(upperBody, armWidth, 2.8, 0.9, 1.45, 1.35, image, UV.playerArm);
  addSkinBox(group, 0.9, 2.8, 0.9, -0.55, -1.5, image, UV.playerLeg);
  addSkinBox(group, 0.9, 2.8, 0.9, 0.55, -1.5, image, UV.playerLeg);

  return { upper: upperBody, head: headPivot };
}

function createCreeper(image) {
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  group.add(headPivot);
  models.add(group);

  headPivot.position.y = 2.6;
  addSkinBox(headPivot, 2, 2, 2, 0, 0, image, UV.head);
  addSkinBox(group, 2, 3, 1, 0, 0.1, image, UV.playerBody);

  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.5, 0.5]) addSkinBox(group, 1, 1.5, 1, x, -2.15, image, UV.creeperLeg).position.z = z;
  }
  return { upper: headPivot, head: null };
}

function createEnderman(image) {
  const group = new THREE.Group();
  const headPivot = new THREE.Group();
  group.add(headPivot);
  models.add(group);

  headPivot.position.y = 3.5;
  addSkinBox(headPivot, 8 * PIXEL_SCALE, 8 * PIXEL_SCALE, 8 * PIXEL_SCALE, 0, 0, image, UV.head);
  addEndermanEyes(headPivot);
  addSkinBox(group, 8 * PIXEL_SCALE, 12 * PIXEL_SCALE, 4 * PIXEL_SCALE, 0, 2, image, UV.endermanBody);
  addSkinBox(group, 2 * PIXEL_SCALE, 30 * PIXEL_SCALE, 2 * PIXEL_SCALE, -0.3, -1.15, image, UV.endermanLimb);
  addSkinBox(group, 2 * PIXEL_SCALE, 30 * PIXEL_SCALE, 2 * PIXEL_SCALE, 0.3, -1.15, image, UV.endermanLimb);
  addSkinBox(group, 2 * PIXEL_SCALE, 30 * PIXEL_SCALE, 2 * PIXEL_SCALE, -0.75, 0.65, image, UV.endermanLimb);
  addSkinBox(group, 2 * PIXEL_SCALE, 30 * PIXEL_SCALE, 2 * PIXEL_SCALE, 0.75, 0.65, image, UV.endermanLimb);
  return { upper: headPivot, head: null };
}

function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${url}`));
    image.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

let activeUpper = null;
let activeHead = null;
let selectedCharacter = 'steve';
let selectionVersion = 0;
window.minecraftFpsLimit ??= 0;

function buildCharacter(name, image) {
  if (name === 'alex') return createPlayer(image, true);
  if (name === 'creeper') return createCreeper(image);
  if (name === 'enderman') return createEnderman(image);
  return createPlayer(image, false);
}

function setCharacter(value) {
  const name = CHARACTER_NAMES.has(value) ? value : 'steve';
  const version = ++selectionVersion;
  selectedCharacter = name;
  window.minecraftCharacter = name;
  models.clear();
  activeUpper = null;
  activeHead = null;

  loadImage(CHARACTER_URLS[name])
    .then((image) => {
      if (version !== selectionVersion) return;
      const model = buildCharacter(name, image);
      activeUpper = model.upper;
      activeHead = model.head;
    })
    .catch(() => {
      if (version === selectionVersion) window.minecraftCharacter = 'steve';
    });
}

window.setMinecraftCharacter = setCharacter;
const requestedCharacter = new URLSearchParams(location.search).get('character');
setCharacter(requestedCharacter || 'steve');

Promise.all([loadImage(grassUrl), loadImage(dirtUrl), loadImage(grassSideUrl)]).then(([grassImage, dirtImage, grassSideImage]) => {
  const block = new THREE.Mesh(getGeometry(3.2, 3.2, 3.2), [
    getPixelMaterial(grassSideImage), getPixelMaterial(grassSideImage), getPixelMaterial(grassImage, 0, 0, 16, 16, '#79c05a'),
    getPixelMaterial(dirtImage), getPixelMaterial(grassSideImage), getPixelMaterial(grassSideImage),
  ]);
  block.position.y = -5;
  scene.add(block);
}).catch(() => undefined);

let targetPitch = 0;
let targetYaw = -0.28;
let visible = !document.hidden;
let lastFrame = 0;

addEventListener('pointermove', (event) => {
  targetPitch = (event.clientY / innerHeight - 0.5) * 0.55;
  targetYaw = (event.clientX / innerWidth - 0.5) * 0.42;
}, { passive: true });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function smooth(current, target, factor, deltaSeconds) {
  return current + (target - current) * (1 - Math.pow(1 - factor, deltaSeconds * 60));
}

function render(now) {
  requestAnimationFrame(render);
  if (!visible) return;
  const fpsLimit = Number(window.minecraftFpsLimit) || 0;
  if (fpsLimit > 0 && now - lastFrame < 1000 / fpsLimit) return;
  const deltaSeconds = Math.min(0.05, (now - lastFrame || 16.67) / 1000);
  lastFrame = now;
  if (activeUpper) {
    activeUpper.rotation.x = smooth(activeUpper.rotation.x, targetPitch, 0.07, deltaSeconds);
    activeUpper.rotation.y = smooth(activeUpper.rotation.y, targetYaw, 0.05, deltaSeconds);
  }
  if (activeHead) {
    activeHead.rotation.x = smooth(activeHead.rotation.x, targetPitch * 0.36, 0.08, deltaSeconds);
    activeHead.rotation.y = smooth(activeHead.rotation.y, targetYaw * 0.36, 0.08, deltaSeconds);
  }
  renderer.render(scene, camera);
}

addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  lastFrame = performance.now();
});
addEventListener('beforeunload', () => renderer.dispose(), { once: true });

resize();
requestAnimationFrame(render);
