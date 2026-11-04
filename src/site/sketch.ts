import * as THREE from 'three';

/**
 * The page before the work, in WebGL, over the wood: its ink drawing (painted onto a canvas, see projectsPage.ts)
 * on the page's paper. It inks itself in as it arrives (patches of line coming up out of the paper, from the grass
 * up), and when the scroll carries you on, it burns away from a point (the middle of the screen) outwards into the
 * wood behind, along a ragged front: a dark wet edge, and just behind it the drawing's own lines lingering a moment
 * over the colours of the clearing before they fade, as if the sketch had been coloured in.
 */

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform vec4 uArt;
  uniform vec2 uGlass;
  uniform float uFar;
  uniform float uArrive;
  uniform float uD;
  uniform float uT;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform float uReady;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.07 + vec2(11.3, 7.9); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 uv = (frag - uArt.xy) / uArt.zw;
    vec4 art = vec4(0.0);
    if (uReady > 0.5 && uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0) art = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
    // arriving: the ink comes up out of the paper in patches, the grass first and the sky last
    float na = fbm(uv * vec2(7.0, 3.5));
    float order = na * 0.42 + (1.0 - uv.y) * 0.58;
    art.a *= smoothstep(order - 0.05, order + 0.01, uArrive * 1.08);
    vec3 col = mix(uPaper, art.rgb, art.a);
    float dark = art.a * (1.0 - dot(art.rgb, vec3(0.299, 0.587, 0.114)));

    // going: a ragged front from the glass out, everything inside it shows the wood
    vec2 sp = frag / uRes.y;
    float n = fbm(sp * 3.2 + vec2(uT * 0.025, -uT * 0.02));
    float n2 = fbm(sp * 11.0 - uT * 0.04);
    float field = length(frag - uGlass) / uFar + (n - 0.5) * 0.42 + (n2 - 0.5) * 0.06;
    float front = uD * 1.5 - 0.22;
    float w = 1.2 * 1.5 / uFar;
    float keep = smoothstep(front - w, front + w, field);
    // the wet, dark edge where it burns
    float edge = (1.0 - smoothstep(0.0, 0.022, abs(field - front - 0.006))) * step(0.0005, uD);
    // and the drawing's lines, lingering a moment behind the front
    float linger = (1.0 - keep) * smoothstep(front - 0.2, front - 0.01, field) * dark;

    float a = keep;
    vec3 pm = col * keep;
    pm += uInk * linger * 0.9;
    a += linger * 0.9 * (1.0 - a);
    pm = mix(pm, uInk * 0.92, edge * 0.88);
    a = mix(a, 0.92, edge * 0.88);
    gl_FragColor = vec4(pm, a);
  }
`;

export type Sketch = {
  /** art: the drawing's rect on screen (CSS px); glass: the glass's centre; far: the reach of the front (CSS px). */
  render: (o: { art: [number, number, number, number]; glass: [number, number]; far: number; arrive: number; d: number; now: number }) => void;
  resize: () => void;
  setPaper: (css: string) => void;
  /** The drawing to show, painted onto a canvas (it's uploaded again each time this is called). */
  setArt: (art: HTMLCanvasElement) => void;
  dispose: () => void;
};

export function createSketch(canvas: HTMLCanvasElement): Sketch {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = {
    uTex: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uArt: { value: new THREE.Vector4() },
    uGlass: { value: new THREE.Vector2() },
    uFar: { value: 1 },
    uArrive: { value: 0 },
    uD: { value: 0 },
    uT: { value: 0 },
    uPaper: { value: new THREE.Color(0xef / 255, 0xe8 / 255, 0xd4 / 255) },
    uInk: { value: new THREE.Color(0x17 / 255, 0x1d / 255, 0x16 / 255) },
    uReady: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  let tex: THREE.CanvasTexture | null = null;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    u.uRes.value.set(Math.round((canvas.clientWidth || window.innerWidth) * dpr), Math.round((canvas.clientHeight || window.innerHeight) * dpr));
  };
  resize();
  return {
    render({ art, glass, far, arrive, d, now }) {
      u.uArt.value.set(art[0] * dpr, art[1] * dpr, art[2] * dpr, art[3] * dpr);
      u.uGlass.value.set(glass[0] * dpr, glass[1] * dpr);
      u.uFar.value = far * dpr;
      u.uArrive.value = arrive;
      u.uD.value = d;
      u.uT.value = now / 1000;
      renderer.render(scene, cam);
    },
    resize,
    setArt(art) {
      tex?.dispose();
      tex = new THREE.CanvasTexture(art);
      tex.colorSpace = THREE.NoColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      u.uTex.value = tex;
      u.uReady.value = 1;
    },
    setPaper(css) {
      // straight through, no colour management: the page's paper exactly
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css.trim());
      if (m) u.uPaper.value.setRGB(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, THREE.LinearSRGBColorSpace);
    },
    dispose() {
      tex?.dispose();
      mat.dispose();
      quad.geometry.dispose();
      renderer.dispose();
    },
  };
}
