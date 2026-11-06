'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * What the film does while you point at one of the project's links (`data-fx` on the link):
 *  - `visit`: the dive, the same straight dolly the forest makes into the screen: the picture pushes in through
 *    slightly bulging glass and holds there, the frame lifting a little. It only blurs (and fringes) while it moves.
 *  - `source`: the film stops on its frame and that frame turns into its code, once: a ripple runs out from the button,
 *    each cell going to a flat pixel and then to a character, coloured by the picture, the picture dim behind. Then
 *    it holds still (nothing re-types or flickers); let go and it ripples back and the film runs on.
 * One small WebGL layer over the video, alive only while a link is pointed at; nothing happens with reduced motion.
 * The warp never samples outside the picture (no smeared edges).
 */

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVid;
uniform sampler2D uAtlas;
uniform sampler2D uCode;
uniform vec2 uRes;
uniform vec2 uCover;
uniform vec2 uCell;
uniform float uPx;
uniform vec2 uOrigin;
uniform float uMaxD;
uniform float uVisit;
uniform float uVel;
uniform float uSource;
uniform int uLen;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 vid(vec2 uv) { return texture(uVid, (uv - 0.5) * uCover + 0.5).rgb; }

// the dive: pushed in through slightly bulging glass; every sample is pulled toward the middle, so it never leaves
// the picture. It blurs toward the middle and fringes only while it's moving (uVel), and is still once there.
vec3 picture(vec2 uv, float v) {
  if (v < 0.001) return vid(uv);
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 q = uv - 0.5;
  float r2 = dot(q * asp, q * asp) / dot(0.5 * asp, 0.5 * asp);
  float mag = (1.0 - 0.1 * v) * mix(1.0, 0.9 + 0.1 * r2, v);
  float len = 0.09 * uVel * sqrt(r2);
  float fr = 0.016 * uVel;
  vec3 acc = vec3(0.0);
  if (len < 0.0005) {
    acc = vec3(vid(0.5 + q * mag).r, vid(0.5 + q * mag * (1.0 - fr * 0.5)).g, vid(0.5 + q * mag * (1.0 - fr)).b);
  } else {
    // a fixed dither (never changing frame to frame), so the streaks are smooth and nothing crawls
    float j = hash(gl_FragCoord.xy);
    for (int i = 0; i < 10; i++) {
      float k = mag * (1.0 - len * (float(i) + j) / 10.0);
      acc.r += vid(0.5 + q * k).r;
      acc.g += vid(0.5 + q * k * (1.0 - fr * 0.5)).g;
      acc.b += vid(0.5 + q * k * (1.0 - fr)).b;
    }
    acc /= 10.0;
  }
  return acc * (1.0 - 0.32 * v * smoothstep(0.3, 1.0, r2));
}

float glyph(int ch, vec2 inCell) {
  ivec2 t = ivec2(floor(inCell / uPx));
  return texelFetch(uAtlas, ivec2(ch * int(uCell.x / uPx) + t.x, t.y), 0).a;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = p / uRes;
  vec3 col = picture(uv, uVisit);
  if (uSource > 0.001) {
    vec2 cell = floor(p / uCell);
    vec2 cc = (cell + 0.5) * uCell;
    float delay = clamp(length(cc - uOrigin) / uMaxD, 0.0, 1.0) * 0.72 + hash(cell + 0.37) * 0.06;
    float t = clamp((uSource * 1.08 - delay) / 0.3, 0.0, 1.0);
    if (t > 0.0) {
      vec3 c = picture(cc / uRes, uVisit);
      float L = dot(c, vec3(0.299, 0.587, 0.114));
      // first a flat pixel of the picture, then its character comes up on the picture dimmed behind it
      col = mix(col, c, smoothstep(0.0, 0.35, t));
      int cols = int(ceil(uRes.x / uCell.x));
      int idx = int(cell.y) * cols + int(cell.x);
      int ch = int(texelFetch(uCode, ivec2(idx % uLen, 0), 0).r * 255.0 + 0.5);
      float g = step(0.45, glyph(ch, p - cell * uCell));
      vec3 bg = vec3(0.045, 0.07, 0.055) + c * 0.3;
      vec3 ink = clamp(c * 1.3 + 0.08, 0.0, 1.0);
      vec3 code = mix(bg, ink, g * (0.35 + 0.65 * smoothstep(0.03, 0.4, L)));
      col = mix(col, code, smoothstep(0.4, 0.9, t));
    }
  }
  o = vec4(col, 1.0);
}`;

const FIRST = 32;
const GLYPHS = 95;
/** One glyph's cell, in CSS pixels; the glyphs are drawn at that size and blown up by whole pixels (pixel art). */
const CW = 7;
const CH = 12;

/** The film's source, as one long minified line of code made from what the project is. */
function codeFor(slug: string, title: string, stack: string[]) {
  const id = (s: string) => s.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'App';
  const fn = id(title);
  const src =
    `import{${stack.map(id).join(',')}}from'./${slug}';` +
    `export default function ${fn}(){const[frame,setFrame]=useState(0);const film=useRef(null);` +
    `useEffect(()=>{let raf=requestAnimationFrame(function tick(t){setFrame((f)=>f+1);raf=requestAnimationFrame(tick);});` +
    `return()=>cancelAnimationFrame(raf);},[]);` +
    `return(<Screen title="${title}" frame={frame} ref={film}>{scenes.map((s,i)=><Scene key={i} {...s} at={frame/30-i}/>)}</Screen>);}` +
    `const scenes=[${stack.map((s) => `{name:'${s}',fade:0.4}`).join(',')}];` +
    `export const meta={slug:'${slug}',by:'ryhox',year:2026};`;
  return Array.from(src, (c) => {
    const n = c.charCodeAt(0) - FIRST;
    return n >= 0 && n < GLYPHS ? n : 0;
  });
}

function atlas() {
  const c = document.createElement('canvas');
  c.width = GLYPHS * CW;
  c.height = CH;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.font = `600 11px Consolas, "Cascadia Mono", Menlo, ui-monospace, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS; i++) g.fillText(String.fromCharCode(FIRST + i), i * CW + CW / 2, CH / 2 + 0.5);
  return c;
}

type Gl = {
  gl: WebGL2RenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
  vid: WebGLTexture;
  lose: () => void;
};

function setup(canvas: HTMLCanvasElement, code: number[]): Gl | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

  const tex = (unit: number, filter: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const vid = tex(0, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 26, 19, 255]));
  tex(1, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas());
  tex(2, gl.NEAREST);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, code.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(code));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);

  const names = ['uVid', 'uAtlas', 'uCode', 'uRes', 'uCover', 'uCell', 'uPx', 'uOrigin', 'uMaxD', 'uVisit', 'uVel', 'uSource', 'uLen'];
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform1i(u.uVid, 0);
  gl.uniform1i(u.uAtlas, 1);
  gl.uniform1i(u.uCode, 2);
  gl.uniform1i(u.uLen, code.length);
  return { gl, u, vid, lose: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export default function FilmFx({ video, slug, title, stack }: { video: RefObject<HTMLVideoElement | null>; slug: string; title: string; stack: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const frame = cv?.parentElement;
    const root = cv?.closest('.screen-page, .project-screen');
    if (!cv || !frame || !root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let g: Gl | null | undefined;
    let raf = 0;
    let last = 0;
    let visit = 0;
    let shown = 0;
    let vel = 0;
    let source = 0;
    let want: 'visit' | 'source' | null = null;
    let link: Element | null = null;
    // the film stops on its frame while it is code, and runs on once the code has gone
    let held = false;
    const hold = (on: boolean) => {
      const v = video.current;
      if (!v || on === held) return;
      if (on && v.paused) return;
      held = on;
      if (on) v.pause();
      else v.play().catch(() => {});
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      visit = Math.max(0, Math.min(1, visit + (want === 'visit' ? dt / 0.9 : -dt / 0.55)));
      source = Math.max(0, Math.min(1, source + (want === 'source' ? dt / 1.0 : -dt / 0.6)));
      if (want === 'source') hold(true);
      else if (source === 0) hold(false);
      const eased = ease(visit);
      // how fast the dive is moving (0 once it's there), smoothed, for the blur
      vel += (Math.min(1, Math.abs(eased - shown) / dt / 2.2) - vel) * Math.min(1, dt * 14);
      shown = eased;
      const v = video.current;
      if (!g || !v || (visit === 0 && source === 0 && !want)) {
        raf = 0;
        last = 0;
        vel = 0;
        delete cv.dataset.on;
        return;
      }
      const { gl, u } = g;
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      gl.viewport(0, 0, w, h);
      if (v.readyState >= 2 && v.videoWidth) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, g.vid);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
        const fa = w / h;
        const va = v.videoWidth / v.videoHeight;
        gl.uniform2f(u.uCover, fa > va ? 1 : fa / va, fa > va ? va / fa : 1);
      } else gl.uniform2f(u.uCover, 1, 1);
      // the glyphs are whole pixels of the screen, blown up together with everything else
      const px = Math.max(1, Math.round(w / r.width));
      gl.uniform2f(u.uRes, w, h);
      gl.uniform2f(u.uCell, CW * px, CH * px);
      gl.uniform1f(u.uPx, px);
      // the ripple runs out from the button you're on
      let ox = w / 2;
      let oy = h * 1.1;
      if (link) {
        const b = link.getBoundingClientRect();
        ox = ((b.left + b.width / 2 - r.left) / r.width) * w;
        oy = ((b.top + b.height / 2 - r.top) / r.height) * h;
      }
      gl.uniform2f(u.uOrigin, ox, oy);
      gl.uniform1f(u.uMaxD, Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - ox, y - oy))));
      gl.uniform1f(u.uVisit, eased);
      gl.uniform1f(u.uVel, vel);
      gl.uniform1f(u.uSource, source);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cv.dataset.on = '';
      raf = requestAnimationFrame(draw);
    };

    const aim = (el: Element | null) => {
      const fx = el?.getAttribute('data-fx');
      want = fx === 'visit' || fx === 'source' ? fx : null;
      if (want) link = el;
      if (want) frame.dataset.film = want;
      else delete frame.dataset.film;
      if (!want) return;
      if (g === undefined) g = setup(cv, codeFor(slug, title, stack));
      if (g && !raf) raf = requestAnimationFrame(draw);
    };
    const linkOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-fx]') : null);
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') aim(linkOf(e.target));
    };
    const out = (e: PointerEvent) => {
      if (linkOf(e.relatedTarget) !== linkOf(e.target)) aim(linkOf(e.relatedTarget));
    };
    const focus = (e: FocusEvent) => {
      const l = linkOf(e.target);
      if (l?.matches(':focus-visible')) aim(l);
    };
    const blur = (e: FocusEvent) => {
      if (!root.querySelector('[data-fx]:hover')) aim(linkOf(e.relatedTarget));
    };
    root.addEventListener('pointerover', over as EventListener);
    root.addEventListener('pointerout', out as EventListener);
    root.addEventListener('focusin', focus as EventListener);
    root.addEventListener('focusout', blur as EventListener);
    // flipped to this project while already pointing at a link
    aim(root.querySelector('[data-fx]:hover'));
    // set up and drawn once ahead, while nothing's asked of it, once the page is the one you're on (the monitor's
    // only once you're inside it): a shader is finished only at its first draw, which mustn't be your first hover
    let warmId = 0;
    const warm = () => {
      warmId = 0;
      if (root.closest('[inert]') || g !== undefined) return;
      g = setup(cv, codeFor(slug, title, stack));
      if (!g) return;
      // a frame of the film taken in once too (the first is the slow one on some graphics cards)
      const v = video.current;
      if (v && v.readyState >= 2) {
        g.gl.activeTexture(g.gl.TEXTURE0);
        g.gl.bindTexture(g.gl.TEXTURE_2D, g.vid);
        g.gl.texImage2D(g.gl.TEXTURE_2D, 0, g.gl.RGBA, g.gl.RGBA, g.gl.UNSIGNED_BYTE, v);
      }
      g.gl.viewport(0, 0, 1, 1);
      g.gl.drawArrays(g.gl.TRIANGLES, 0, 3);
    };
    const askWarm = () => {
      if (!warmId && !root.closest('[inert]') && g === undefined) warmId = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 1500 }) : (setTimeout(warm, 600) as unknown as number);
    };
    const mo = new MutationObserver(askWarm);
    for (let p: Element | null = root; p; p = p.parentElement) mo.observe(p, { attributes: true, attributeFilter: ['inert'] });
    askWarm();
    return () => {
      mo.disconnect();
      if (warmId) {
        if ('cancelIdleCallback' in window) window.cancelIdleCallback(warmId);
        clearTimeout(warmId);
      }
      root.removeEventListener('pointerover', over as EventListener);
      root.removeEventListener('pointerout', out as EventListener);
      root.removeEventListener('focusin', focus as EventListener);
      root.removeEventListener('focusout', blur as EventListener);
      cancelAnimationFrame(raf);
      hold(false);
      delete frame.dataset.film;
      g?.lose();
    };
  }, [video, slug, title, stack]);

  return <canvas ref={canvas} className="sp-fx" aria-hidden="true" />;
}
