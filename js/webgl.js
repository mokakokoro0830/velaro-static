import * as THREE from 'three';

// ─── Background vertex shader ────────────────────────────────────────────
const bgVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Background fragment shader ──────────────────────────────────────────
const bgFragmentShader = /* glsl */`
  uniform sampler2D uTexture;
  uniform float     uTime;
  uniform float     uVelocity;
  uniform float     uProgress;

  varying vec2 vUv;

  // ── Hash / noise / FBM ──────────────────────────────────────────────────
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = smoothstep(0.0, 1.0, fract(p));
    return mix(
      mix(hash21(i),              hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p  = p * 2.07 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // ── Caustics: refracted water-light shimmer ──────────────────────────────
  float caustic(vec2 uv, float t) {
    vec2 p = uv * 3.5;
    float a = fbm(p + vec2( t * 0.13,  t * 0.07));
    float b = fbm(p + vec2(-t * 0.09,  t * 0.11) + vec2(3.7, 2.1));
    // Bright crests where two FBM fields nearly cancel
    return pow(clamp(1.0 - abs(sin(a * 6.28 - b * 4.2)), 0.0, 1.0), 5.0);
  }

  // ── Film grain ───────────────────────────────────────────────────────────
  float grain(vec2 uv, float t) {
    vec2 p = fract(uv * 256.0 + vec2(t * 0.013, t * 0.009));
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Ken Burns: slow breathe + gentle horizontal drift
    vec2 uv = vUv;
    float breathe = 1.0 + sin(uTime * 0.12) * 0.012 + uProgress * 0.12;
    uv = (uv - 0.5) / breathe + 0.5;
    uv.y += uProgress * 0.05;
    uv.x += sin(uTime * 0.07) * 0.006;

    // Chromatic aberration — only during scroll
    float shift = abs(uVelocity) * 0.0025;
    float r = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
    float g = texture2D(uTexture, uv                   ).g;
    float b = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
    vec3 col = vec3(r, g, b);

    // ── Caustics overlay ─────────────────────────────────────────────────
    // Fades out as you scroll deeper (surface light fades with depth)
    float cStrength = caustic(vUv, uTime) * (1.0 - uProgress * 0.8) * 0.11;
    col += cStrength * vec3(0.82, 0.95, 1.0);   // cool water-light tint

    // Vignette
    float d = length(vUv - 0.5) * 1.3;
    col *= 1.0 - d * d * 0.35;

    // Darken as scroll deepens
    col *= 1.0 - uProgress * 0.28;

    // ── Scroll color grade: warm golden → deep ocean blue ────────────────
    float p2 = smoothstep(0.0, 1.0, uProgress); // linear ease
    vec3 warmTint = vec3(1.03, 0.98, 0.91);      // subtle golden hour
    vec3 coolTint = vec3(0.88, 0.94, 1.04);      // subtle deep water
    vec3 tint = mix(warmTint, coolTint, p2);
    col *= tint;

    // ── Film grain — pulses with velocity, stays subtle ──────────────────
    float grainAmt = 0.024 + abs(uVelocity) * 0.05;
    col += (grain(vUv, uTime) - 0.5) * grainAmt;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Ripple vertex shader (villa cards) ──────────────────────────────────
const rippleVertexShader = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uHover;

  varying vec2 vUv;

  void main() {
    vec2 wv = uv;

    // Hover ripple radiating from mouse
    vec2  d    = uv - uMouse;
    float dist = length(d);
    float wave = sin(dist * 28.0 - uTime * 7.0) * uHover * 0.025;
    wave *= smoothstep(0.65, 0.0, dist);
    wv   += normalize(d + 0.0001) * wave;

    vUv = wv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Ripple fragment shader ───────────────────────────────────────────────
const rippleFragmentShader = /* glsl */`
  uniform sampler2D uTexture;
  uniform float     uVelocity;
  uniform float     uHover;

  varying vec2 vUv;

  void main() {
    float shift = abs(uVelocity) * 0.007;
    float r = texture2D(uTexture, vUv + vec2(shift,  0.0)).r;
    float g = texture2D(uTexture, vUv                    ).g;
    float b = texture2D(uTexture, vUv - vec2(shift,  0.0)).b;
    float a = texture2D(uTexture, vUv                    ).a;

    vec3 col = vec3(r, g, b);

    // ── Vignette: dissolves on hover ──────────────────────────────────────
    float vignStrength = mix(0.55, 0.0, uHover);  // full vignette → clear
    float d = length(vUv - 0.5) * 1.5;
    col *= 1.0 - d * d * vignStrength;

    // ── Brightness & warmth lift on hover ────────────────────────────────
    col *= 1.0 + uHover * 0.12;
    col = mix(col, col * vec3(1.04, 1.01, 0.97), uHover * 0.5); // warm push
    gl_FragColor = vec4(col, a);
  }
`;

// ─── Gradient placeholder texture ────────────────────────────────────────
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

// ─── Shared scroll state ──────────────────────────────────────────────────
let scrollY      = window.scrollY;
let prevScrollY  = scrollY;
let rawVelocity  = 0;
let smoothVel    = 0;
let scrollProgress = 0;

window.addEventListener('scroll', () => {
  const newY  = window.scrollY;
  // Clamp to ±60px per frame so programmatic jumps don't blow up the shader
  rawVelocity = Math.max(-60, Math.min(60, newY - prevScrollY));
  prevScrollY = newY;
  scrollY     = newY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  scrollProgress  = maxScroll > 0 ? newY / maxScroll : 0;
}, { passive: true });

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND — single fixed full-viewport canvas
// ═══════════════════════════════════════════════════════════════════════════
function initBackground() {
  const canvas = document.getElementById('webgl-bg');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  resize();
  window.addEventListener('resize', resize);

  const geo = new THREE.PlaneGeometry(2, 2, 48, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader:   bgVertexShader,
    fragmentShader: bgFragmentShader,
    uniforms: {
      uTime:     { value: 0 },
      uVelocity: { value: 0 },
      uProgress: { value: 0 },
      uTexture:  { value: makeGradient('#7FAEC4', '#EDE5DA', 1024, 512) },
    },
  });

  const loader = new THREE.TextureLoader();
  loader.load('images/hero.jpg',
    tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.uniforms.uTexture.value = tex; },
    undefined, () => {}
  );

  scene.add(new THREE.Mesh(geo, mat));

  let t = 0;
  (function tick() {
    requestAnimationFrame(tick);
    t += 0.016;
    smoothVel += (rawVelocity - smoothVel) * 0.08;

    mat.uniforms.uTime.value     = t;
    mat.uniforms.uVelocity.value = smoothVel * 0.04;
    mat.uniforms.uProgress.value = scrollProgress;

    renderer.render(scene, camera);
  })();
}

// ═══════════════════════════════════════════════════════════════════════════
// VILLA RIPPLE — lightweight per-card canvas
// ═══════════════════════════════════════════════════════════════════════════
function initVillaRipples() {
  const cards = document.querySelectorAll('.villa-card');
  if (!cards.length) return;

  const COLORS = [
    ['#B8D4E0', '#7FAEC4'],
    ['#E8D5B8', '#C4A882'],
    ['#F5EBD8', '#D4C4B0'],
  ];
  const SRCS = [
    'images/villa-overwater.jpg',
    'images/villa-beach.jpg',
    'images/villa-sunrise.jpg',
  ];

  cards.forEach((card, idx) => {
    const media = card.querySelector('.villa-card__media');
    if (!media) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'ripple-canvas';
    media.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geo = new THREE.PlaneGeometry(2, 2, 36, 36);
    const mat = new THREE.ShaderMaterial({
      vertexShader:   rippleVertexShader,
      fragmentShader: rippleFragmentShader,
      uniforms: {
        uTime:     { value: 0 },
        uVelocity: { value: 0 },
        uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
        uHover:    { value: 0 },
        uTexture:  { value: makeGradient(...COLORS[idx % COLORS.length]) },
      },
      transparent: true,
    });

    const loader = new THREE.TextureLoader();
    loader.load(SRCS[idx],
      tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.uniforms.uTexture.value = tex; },
      undefined, () => {}
    );

    scene.add(new THREE.Mesh(geo, mat));

    function resizeCanvas() {
      renderer.setSize(media.clientWidth, media.clientHeight, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let isHovered   = false;
    let targetHover = 0;
    let t = 0;
    let animId = null;

    media.addEventListener('mouseenter', () => {
      isHovered   = true;
      targetHover = 1;
      canvas.classList.add('active');
      if (!animId) tick();
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

    function tick() {
      animId = requestAnimationFrame(tick);
      t += 0.016;
      mat.uniforms.uHover.value    += (targetHover - mat.uniforms.uHover.value) * 0.07;
      mat.uniforms.uTime.value      = t;
      mat.uniforms.uVelocity.value += (rawVelocity * 0.02 - mat.uniforms.uVelocity.value) * 0.1;

      if (!isHovered && mat.uniforms.uHover.value < 0.005) {
        canvas.classList.remove('active');
        cancelAnimationFrame(animId);
        animId = null;
        return;
      }
      renderer.render(scene, camera);
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────
initBackground();
initVillaRipples();
