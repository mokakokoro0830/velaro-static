import * as THREE from 'three';

// ─── Vertex shader (shared) ───────────────────────────────────────────
const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uVelocity;   // scroll velocity for hero
  uniform vec2  uMouse;      // UV-space mouse (0-1) for ripple
  uniform float uHover;      // 0→1 lerped on hover
  uniform float uRippleMode; // 0=scroll-only  1=ripple+scroll

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;

    // Scroll wave distortion (hero)
    float vel = abs(uVelocity);
    p.z += sin(uv.x * 10.0 + uTime * 2.0) * uVelocity * 0.10;
    p.z += sin(uv.y *  8.0 + uTime * 1.4) * uVelocity * 0.07;

    // Hover ripple (villa cards)
    if (uRippleMode > 0.5) {
      vec2  d    = uv - uMouse;
      float dist = length(d);
      float wave = sin(dist * 28.0 - uTime * 7.0) * uHover * 0.035;
      wave *= smoothstep(0.65, 0.0, dist);
      p.z += wave;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// ─── Fragment shader (shared) ─────────────────────────────────────────
const fragmentShader = /* glsl */`
  uniform sampler2D uTexture;
  uniform float     uVelocity;
  uniform float     uHover;

  varying vec2 vUv;

  void main() {
    // Chromatic aberration on scroll
    float shift = abs(uVelocity) * 0.007;
    float r = texture2D(uTexture, vUv + vec2(shift,  0.0)).r;
    float g = texture2D(uTexture, vUv                    ).g;
    float b = texture2D(uTexture, vUv - vec2(shift,  0.0)).b;
    float a = texture2D(uTexture, vUv                    ).a;

    // Subtle brightness lift on hover
    vec3 col = vec3(r, g, b) * (1.0 + uHover * 0.06);
    gl_FragColor = vec4(col, a);
  }
`;

// ─── Gradient placeholder texture ─────────────────────────────────────
function makeGradient(c1, c2, w = 512, h = 512) {
  const cv  = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = cv.getContext('2d');
  const g   = ctx.createLinearGradient(0, 0, w * 0.7, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(cv);
}

// Placeholder palettes (replaced by real images when /img generates them)
const HERO_COLORS   = ['#7FAEC4', '#EDE5DA'];
const VILLA_COLORS  = [
  ['#B8D4E0', '#7FAEC4'],
  ['#E8D5B8', '#C4A882'],
  ['#F5EBD8', '#D4C4B0'],
];

// ─── Shared scroll state ──────────────────────────────────────────────
let scrollY      = window.scrollY;
let prevScrollY  = scrollY;
let rawVelocity  = 0;
let smoothVelocity = 0;

window.addEventListener('scroll', () => {
  scrollY     = window.scrollY;
  rawVelocity = scrollY - prevScrollY;
  prevScrollY = scrollY;
}, { passive: true });

// ═══════════════════════════════════════════════════════════════════════
// HERO WebGL
// ═══════════════════════════════════════════════════════════════════════
function initHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const scene    = new THREE.Scene();
  const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  resize();
  window.addEventListener('resize', resize);

  // Plane fills viewport via ortho camera
  const geo = new THREE.PlaneGeometry(2, 2, 40, 40);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:       { value: 0 },
      uVelocity:   { value: 0 },
      uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
      uHover:      { value: 0 },
      uRippleMode: { value: 0 },
      uTexture:    { value: makeGradient(...HERO_COLORS, 1024, 512) },
    },
  });

  // Load real image if available
  const loader = new THREE.TextureLoader();
  loader.load('images/hero.jpg',
    tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.uniforms.uTexture.value = tex; },
    undefined, () => {}
  );

  scene.add(new THREE.Mesh(geo, mat));

  let t = 0;
  function tick() {
    requestAnimationFrame(tick);
    t += 0.016;
    smoothVelocity += (rawVelocity - smoothVelocity) * 0.08;

    mat.uniforms.uTime.value     = t;
    mat.uniforms.uVelocity.value = smoothVelocity * 0.04;
    renderer.render(scene, camera);
  }
  tick();
}

// ═══════════════════════════════════════════════════════════════════════
// VILLA RIPPLE WebGL (one renderer per card, lightweight)
// ═══════════════════════════════════════════════════════════════════════
function initVillaRipples() {
  const cards = document.querySelectorAll('.villa-card');
  if (!cards.length) return;

  cards.forEach((card, idx) => {
    const media = card.querySelector('.villa-card__media');
    if (!media) return;

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.className = 'ripple-canvas';
    media.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geo = new THREE.PlaneGeometry(2, 2, 36, 36);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:       { value: 0 },
        uVelocity:   { value: 0 },
        uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
        uHover:      { value: 0 },
        uRippleMode: { value: 1 },
        uTexture:    { value: makeGradient(...VILLA_COLORS[idx % VILLA_COLORS.length]) },
      },
      transparent: true,
    });

    // Load real villa image
    const srcs = ['images/villa-overwater.jpg', 'images/villa-beach.jpg', 'images/villa-sunrise.jpg'];
    const loader = new THREE.TextureLoader();
    loader.load(srcs[idx],
      tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.uniforms.uTexture.value = tex; },
      undefined, () => {}
    );

    scene.add(new THREE.Mesh(geo, mat));

    function resizeCanvas() {
      const w = media.clientWidth;
      const h = media.clientHeight;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let isHovered   = false;
    let targetHover = 0;
    let t = 0;

    media.addEventListener('mouseenter', () => {
      isHovered   = true;
      targetHover = 1;
      canvas.classList.add('active');
    });
    media.addEventListener('mouseleave', () => {
      isHovered   = false;
      targetHover = 0;
    });
    media.addEventListener('mousemove', e => {
      const rect = media.getBoundingClientRect();
      mat.uniforms.uMouse.value.set(
        (e.clientX - rect.left)  / rect.width,
        1 - (e.clientY - rect.top) / rect.height
      );
    });

    let animId = null;
    function tick() {
      animId = requestAnimationFrame(tick);
      t += 0.016;
      mat.uniforms.uHover.value    += (targetHover - mat.uniforms.uHover.value) * 0.07;
      mat.uniforms.uTime.value      = t;
      mat.uniforms.uVelocity.value += (rawVelocity * 0.02 - mat.uniforms.uVelocity.value) * 0.1;

      // Stop rendering when fully idle (save GPU)
      if (!isHovered && mat.uniforms.uHover.value < 0.005) {
        canvas.classList.remove('active');
        cancelAnimationFrame(animId);
        animId = null;
        return;
      }
      renderer.render(scene, camera);
    }

    // Start loop on hover
    media.addEventListener('mouseenter', () => {
      if (!animId) tick();
    });
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────
initHero();
initVillaRipples();
