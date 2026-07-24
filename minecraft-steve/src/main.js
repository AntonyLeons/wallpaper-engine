import '../style.css';
import './steve.js';

const canvas = document.querySelector('#fx');
const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
const settings = { particles: 75, speed: 1, enabled: true, fps: 60 };
const embers = [];
const enderAura = [];

let width = 0;
let height = 0;
let dpr = 1;
let visible = !document.hidden;
let lastFrame = 0;

function spawnEmber(initial) {
  return {
    x: Math.random() * width,
    y: initial ? Math.random() * height : height + 10,
    radius: 1 + Math.random() * 2.8,
    speed: 14 + Math.random() * 28,
    alpha: 0.16 + Math.random() * 0.45,
    drift: (Math.random() - 0.5) * 14,
  };
}

function spawnAura() {
  return {
    x: width * (0.5 + (Math.random() - 0.5) * 0.32),
    y: height * (0.52 + (Math.random() - 0.5) * 0.62),
    radius: 3 + Math.random() * 5,
    speed: 10 + Math.random() * 20,
    alpha: 0.38 + Math.random() * 0.42,
    drift: (Math.random() - 0.5) * 26,
  };
}

function syncEmbers() {
  while (embers.length < settings.particles) embers.push(spawnEmber(true));
  embers.length = Math.min(embers.length, settings.particles);
}

function resize() {
  width = innerWidth;
  height = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  syncEmbers();
}

function drawEmbers(deltaSeconds) {
  context.fillStyle = '#ffb94c';
  for (const ember of embers) {
    ember.y -= ember.speed * settings.speed * deltaSeconds;
    ember.x += ember.drift * deltaSeconds;
    if (ember.y < -15) Object.assign(ember, spawnEmber(false));
    context.globalAlpha = ember.alpha;
    context.beginPath();
    context.arc(ember.x, ember.y, ember.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawEnderAura(deltaSeconds) {
  while (enderAura.length < 34) enderAura.push(spawnAura());
  context.fillStyle = '#c951ff';
  for (const particle of enderAura) {
    particle.y -= particle.speed * settings.speed * deltaSeconds;
    particle.x += particle.drift * deltaSeconds;
    if (particle.y < height * 0.16 || particle.x < width * 0.3 || particle.x > width * 0.7) Object.assign(particle, spawnAura());
    const size = Math.round(particle.radius);
    context.globalAlpha = particle.alpha;
    context.fillRect(particle.x - size, particle.y - 1, size * 2 + 2, 3);
    context.fillRect(particle.x - 1, particle.y - size, 3, size * 2 + 2);
    context.fillRect(particle.x - size * 0.45, particle.y - size * 0.45, size * 0.9, size * 0.9);
  }
}

function render(now) {
  requestAnimationFrame(render);
  if (!visible) {
    lastFrame = now;
    return;
  }
  if (settings.fps > 0 && now - lastFrame < 1000 / settings.fps) return;

  const deltaSeconds = Math.min(0.05, (now - lastFrame || 16.67) / 1000);
  lastFrame = now;
  context.clearRect(0, 0, width, height);
  if (!settings.enabled) return;

  drawEmbers(deltaSeconds);
  if (window.minecraftCharacter === 'enderman') drawEnderAura(deltaSeconds);
  context.globalAlpha = 1;
}

const existingListener = window.wallpaperPropertyListener ?? {};
const previousGeneralProperties = existingListener.applyGeneralProperties;
const previousUserProperties = existingListener.applyUserProperties;

existingListener.applyGeneralProperties = (properties) => {
  previousGeneralProperties?.(properties);
  if (typeof properties.fps === 'number') {
    settings.fps = Math.max(0, properties.fps);
    window.minecraftFpsLimit = settings.fps;
  }
};

existingListener.applyUserProperties = (properties) => {
  previousUserProperties?.(properties);
  if (typeof properties.character?.value === 'string') window.setMinecraftCharacter?.(properties.character.value);
  if (typeof properties.effects?.value === 'boolean') settings.enabled = properties.effects.value;
  if (typeof properties.particlecount?.value === 'number') {
    settings.particles = Math.max(0, Math.min(180, Math.round(properties.particlecount.value)));
    syncEmbers();
  }
  if (typeof properties.effectspeed?.value === 'number') settings.speed = Math.max(0.2, Math.min(2, properties.effectspeed.value));
};

window.wallpaperPropertyListener = existingListener;

addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  lastFrame = performance.now();
});

resize();
requestAnimationFrame(render);
