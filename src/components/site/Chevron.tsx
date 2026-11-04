/** A pixel chevron for the prev/next buttons, pointing left (or right, flipped). */
export default function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg className="sp-chev" viewBox="0 0 5 7" shapeRendering="crispEdges" aria-hidden="true" style={flip ? { scale: '-1 1' } : undefined}>
      <path d="M3 0h1v1H3zM2 1h1v1H2zM1 2h1v1H1zM0 3h1v1H0zM1 4h1v1H1zM2 5h1v1H2zM3 6h1v1H3z" fill="currentColor" />
    </svg>
  );
}
