@AGENTS.md

# Ryhox portfolio v3

One scroll walk into a pixel-art forest: the edge of the wood (hero, "ryhox" floating in 3D), the clearing with the
old computer and the project discs, the cat's hollow (footer). Next.js 16, vanilla Three.js, Lenis.

## How it's built
- Every sprite and layer is painted in code (`src/scene/art/`), in a Web Worker (`art/worker.ts`) so the page is usable
  at once and the wood fills in. Most visible layers are painted first.
- Layers are flat painted cards facing the camera, each painted for a distance `d` so it sits pixel-for-pixel on screen
  from its resting view (`K0` in `src/scene/config.ts`). The camera never tilts.
- The forest renders into a small target (about 250 px on the short side) and is scaled up by a whole number, so pixels
  stay crisp on every screen.
- Light (`src/scene/gl.ts`): one sun with a shadow map, a roof of leaves that only casts shadows (`art/roof.ts`, exactly one
  gap: the beam onto the computer), volumetric height fog ray-marched through the shadow map, and the monitor as a point light.
  Light and fog change along the walk (`ATMOS` in config). Rain puddles (`PUDDLES`) reflect a mirrored render; none in the meadow.
- Loading: a pixel-art loading screen (`src/components/Loader.tsx`, the cat from the hollow) shows instantly and fades when
  the forest is ready. The user disliked a frozen snapshot of the scene (it looked weird on F5).
- One real floor plane under the whole walk (no per-layer ground strips).
- Trees are single sprites (`art/trees.ts`, five kinds) planted at real depths, batched per sprite. Leaves are stamped one by one.
- Words in the forest (`src/scene/boards.ts`): the hero socials and the project panel are painted sharp and hung in 3D, drawn
  in a full-resolution pass after the pixels, depth-tested against the forest. The page's real links (`data-pin`) ride on top.
  The disc names are painted on each floppy's label in the same pass. The footer is plain page text.
- Page elements pinned over the forest each frame: disc buttons and the project video on the monitor's glass.
- Pill mode (`src/scene/play.ts`, `world.ts`, `art/gear.ts`): a second after you reach the cat she holds out a paw with a
  pill ("Stay a while?" + Take, `components/Pill.tsx`). Take dissolves you into the meadow where the walk starts, free to
  roam in first person inside an invisible fence (`BOUNDS`); the wood carries on past it into the fog. Done the 2.5D way:
  the camera only turns (yaw), every sprite turns with it (`view.yaw` in `gl.ts`), looking up/down is a projection shear
  so trees never lean. Secrets only there: a lake behind the start, a river down the far left, a pond with a fairy ring.
  Walk-only / play-only meshes are flagged `walkOnly` / `playOnly`; the walk must look exactly as it did.
  Favicons: cat (`app/icon.svg`), pill in pill mode.
- In pill mode things are real 3D (`solid.ts`): trees are round trunks with crowns of leaf-clump cards, the stump is
  lathed, the computer and notice board are their sprites pushed out into slabs (painted backs), floppies are flat boxes
  with their names. Small things (grass, flowers, animals, the cat) stay sprites. Every sprite is lit as if it faced
  the sun (`view.lightYaw`), so the light never changes as you turn.
- The rifle is a 3D model (`gun.ts`, no hands), its own pass laid over the view; right-click raises it to a realistic
  scope (scope pass in `play.ts`: tunnel-in, lens bend, colour fringe, scope shadow, glare, duplex reticle). The
  eyepiece shows the live view. Hits: hit marker, "+1" with the distance ("23m!"), the animal bursts into its own
  pixels with cartoon-red spray (jam, not gore). The notice board and the monitor's glass can be shot to pieces.
  E puts a floppy into the computer. You can wade into the water (rings, splashes). Esc shows a wooden sign menu.

## The user's rules (keep this list current)
- Professional, whimsical, hazy-film mood. Not gamey.
- No glow, borders, cards, glassmorphism, eyebrows, dots, live clocks. One exception the user asked for: the project
  text sits on a cottagecore notice board in the clearing (planks, shingled roof, posts in the grass, a cream note
  with gingham tape and a flower sprig, dark ink) that slides in as you arrive and aside as you walk on (`boards.ts`).
- Don't add elements or change the composition without asking. Screenshot every stop before reporting.
- Exactly one light ray, the engine's own (not a sprite), onto the PC. User: "TOO MUCH LIGHT RAYS".
- Grass in clumps beside the path, path clear, so the distance stays readable and the animals stand out.
- Lots of flowers and mushrooms (natural colours, never pastel). Grass spread evenly everywhere, path or not.
- No cursor parallax: the camera only follows the scroll.
- No pixel-art man or photo of the user in the scene (removed on request).
- The footer stays normal page text, not 3D.
- Leaves are individual leaf stamps; moss is a fine speckle (the round clumps and camo moss were hated).
- Never stretch pixels (no clamped edges that smear), no holes/tunnels at the end, no swirl "hole" around the cat.
- No tree sway, no firs, no water in the hero.
- Loading must feel instant.
- Weather along the walk (`ATMOS`): a fine sunny day at the edge, greyer and mistier deeper in, bright again in the
  clearing, dark down to the cat. The sky follows it: blue with a few pixel clouds outside, a grey lid deeper in.
- The wood looks the same for everyone: everything seeded, tree sprites put in a fixed order before planting.
- Trees reach the edges of wide screens (a second, sparser band further out); no empty mist at the sides.
- The hollow (its tall swirl wall) is hidden until you leave the clearing, so it never stands over the wood.
- "ryhox" is dressed with small posies on the letters themselves (`art/garland.ts`), not bushes beside the word.
- Social icons: each brand's real mark, flat cream on a dark disc (`content/icons.ts`), like a clean pixel logo.
- Scrolling down into the clearing catches you softly (the camera rides a spring and bounces a little); the very next
  scroll goes on at once. Scrolling back up never catches.

## Scripts
- `npm run dev`, `npm run build`, `npm run lint` (tsc).
- `npm run screens` makes tiny screen images from `assets/work` (unused while the monitor plays the real videos).
