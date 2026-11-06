/**
 * What WebGL this browser gives: none at all, only a slow software one, or a real graphics card's. Asked of a scrap
 * canvas, which fails quietly: three.js writes an error to the console when it can't make a context, so the page
 * asks first and doesn't try where there's nothing to get (a browser without WebGL keeps a clean console). Asked once.
 */
let kind: 'none' | 'soft' | 'gpu' | null = null;

export function webgl(): 'none' | 'soft' | 'gpu' {
  if (kind) return kind;
  const ask = (opts: WebGLContextAttributes) => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2', opts);
      // let it go again straight away: contexts are few
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return !!gl;
    } catch {
      return false;
    }
  };
  kind = ask({ failIfMajorPerformanceCaveat: true }) ? 'gpu' : ask({}) ? 'soft' : 'none';
  return kind;
}

/** For the places that need it: an error that says there's no WebGL, without anything written to the console. */
export class NoWebGL extends Error {
  constructor() {
    super('No WebGL in this browser');
    this.name = 'NoWebGL';
  }
}
