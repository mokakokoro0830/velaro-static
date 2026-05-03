import * as THREE from 'three';

// ─── Background vertex shader ────────────────────────────────────────────
const bgVertexShader = /* glsl */`
  uniform float uTime;
  uniform float uVelocity;
  varying vec2 vUv;

  void main() {
    // UV-space wave distortion — actually visible with orthographic camera
    // (Z displacement has no effect with ortho projection and causes clipping)
    vec2 wv = uv;
    wv.x += sin(uv.y * 12.0 + uTime * 1.2) * uVelocity * 0.012;
    wv.y += sin(uv.x * 10.0 + uTime * 0.9) * uVelocity * 0.010;
    vUv = wv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Background fragment shader ──────────────────────────────────────────
const bgFragmentShader = /* glsl */`
  uniform sampler2D uTexture;
  uniform float     uTime;
  uniform float     uVelocity;
  uniform float     uProgress; // 0–1 through full page

  varying vec2 vUv;

  void main() {
    // Slow parallax: zoom out + drift as we scroll
    vec2 uv = vUv;
    float zoom = 1.0 + uProgress * 0.18;
    uv = (uv - 0.5) / zoom + 0.5;
    uv.y += uProgress * 0.06;

    // Chromatic aberration on scroll
    float shift = abs(uVelocity) * 0.006;
    float r = texture2D(uTexture, uv + vec2(shift,  0.0)).r;
    float g = texture2D(uTexture, uv                    ).g;
    float b = texture2D(uTexture, uv - vec2(shift,  0.0)).b;

    vec3 col = vec3(r, g, b);

    // Subtle vignette
    float d = length(vUv - 0.5) * 1.4;
    col *= 1.0 - d * d * 0.3;

    // Darken as scroll deepens
    col *= 1.0 - uProgress * 0.28;

    // Shimmer — fades out as page darkens
    float shimmer = sin(vUv.x * 60.0 - uTime * 2.5) * 0.5 + 0.5;
    shimmer      *= sin(vUv.y * 40.0 + uTime * 1.8) * 0.5 + 0.5;
    col          += shimmer * 0.014 * (1.0 - uProgress);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Ripple vertex shader (villa cards) ──────────────────────────────────
const rippleVertexShader = /* glsl */`
  uniform float uTime;
  uniform float uVelocity;
  uniform vec2  uMouse;
  uniform float uHover;

  varying vec2 vUv;

  void main() {
    // UV-space distortion — deforms the texture, works with orthographic camera
    vec2 wv = uv;

    // Scroll wave
    wv.x += sin(uv.y * 10.0 + uTime * 2.0) * uVelocity * 0.015;
    wv.y += sin(uv.x *  8.0 + uTime * 1.4) * uVelocity * 0.012;

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

    vec3 col = vec3(r, g, b) * (1.0 + uHover * 0.06);
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
