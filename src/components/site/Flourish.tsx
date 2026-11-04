/**
 * The page's flourish, 360 × 40 units: vines curling away from a knot of dots, a leaf on each. Drawn by the pen
 * wherever it's used (each path has a pathLength of 1, for a dash to draw it in with).
 */
export function FlourishPaths() {
  return (
    <>
      <path pathLength={1} d="M178 22c-14 0-22-9-34-9-16 0-20 14-36 14-18 0-24-12-44-12-14 0-22 6-34 6-10 0-14-6-24-6M178 22c-6-8-14-10-20-6-5 4-2 11 4 10 4-1 4-6 0-7" />
      <path pathLength={1} d="M182 22c14 0 22-9 34-9 16 0 20 14 36 14 18 0 24-12 44-12 14 0 22 6 34 6 10 0 14-6 24-6M182 22c6-8 14-10 20-6 5 4 2 11-4 10-4-1-4-6 0-7" />
      <path pathLength={1} d="M112 21c4-7 11-9 16-6-4 5-11 7-16 6zM248 21c-4-7-11-9-16-6 4 5 11 7 16 6zM60 16c3-6 9-8 13-5-3 4-9 6-13 5zM300 16c-3-6-9-8-13-5 3 4 9 6 13 5z" />
      <g className="rule-dots">
        <circle cx="180" cy="22" r="2.6" />
        <circle cx="173" cy="10" r="1.4" />
        <circle cx="187" cy="10" r="1.4" />
        <circle cx="180" cy="33" r="1.2" />
      </g>
    </>
  );
}
