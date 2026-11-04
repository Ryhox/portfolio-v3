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
- The disc names are painted sharp on each floppy's label in a full-resolution pass after the pixels, depth-tested
  against the forest. The footer is plain page text. The computer stands in the middle of the clearing.
- Page elements pinned over the forest each frame: disc buttons, and the monitor's glass (`#pin-screen`).
- The monitor is an old TV that's always on (`screenStatic` / `screenTune` in `art/props.ts`): dim static while it
  waits; a disc tunes it in (the page fades up through matching static), and when the disc comes out the page
  dissolves back into static. Keep it calm: no flashes, no switch-on lines, no cursor, no top-to-bottom wipes.
  A flip inside is a faint grain over the whole screen, never full noise and never just the video.
- The project lives on the screen (`components/ScreenPage.tsx`): a page in the page's own style (paper, Fraunces title
  with the flourish, kicker, description, stack as paper tags, pixel buttons), title along the top, video left and
  description right, prev/next + links along the bottom, Leave top right. It's laid out at the window's size and scaled
  onto the glass (`--k`, `fitPage` in the engine), tuning in through static. Once a disc has booted the TV, `full` is set
  and the camera dives into the glass (`leanIn`: a straight dolly, never a turn) until the glass covers the window and
  the page is exactly the window. Flips swap the project on the page (the video tunes in afresh; the drive swaps the
  disc unseen). Leave leans back out, then the disc comes out. Inside, the scroll holds still.
- Pill mode (`src/scene/play.ts`, `world.ts`, `art/gear.ts`) is a secret: the only way in is typing `Enter.PillMode()` in
  the browser console (`src/site/pill.ts`; no paw offer at the cat, no nav link). On load the console prints the secret
  commands (`Enter.PillMode()`, `pill.cases()`, `pill.reset()`), never the points cheat `pill.points()`. From the console
  there's no click to take the mouse, so you land on the pause screen ("Keep exploring"). It dissolves you into the meadow
  where the walk starts, free to roam in first person inside an invisible fence (`BOUNDS`); the wood carries on past it into the fog. Done the 2.5D way:
  the camera only turns (yaw), every sprite turns with it (`view.yaw` in `gl.ts`), looking up/down is a projection shear
  so trees never lean. Secrets only there: a lake behind the start, a river down the far left, a pond with a fairy ring.
  Walk-only / play-only meshes are flagged `walkOnly` / `playOnly`; the walk must look exactly as it did.
  Favicons: cat (`app/icon.svg`), pill in pill mode.
- In pill mode things are real 3D (`solid.ts`): trees are round trunks with crowns of leaf-clump cards, the stump is
  lathed, the computer is its sprite pushed out into a slab (painted back), floppies are flat boxes
  with their names. Small things (grass, flowers, animals, the cat) stay sprites. Every sprite is lit as if it faced
  the sun (`view.lightYaw`), so the light never changes as you turn.
- The rifle is a 3D model (`gun.ts`, no hands), its own pass laid over the view; right-click raises it to a realistic
  scope (scope pass in `play.ts`: tunnel-in, lens bend, colour fringe, scope shadow, glare, duplex reticle). The
  eyepiece shows the live view. Hits: hit marker, "+1" with the distance ("23m!"), the animal bursts into its own
  pixels with cartoon-red spray (jam, not gore). The monitor's glass can be shot to pieces.
  E puts a floppy into the computer. You can wade into the water (rings, splashes).
- Pill mode extras: leaves and bushes are 3D volumes (`foliage.ts`: lumpy cores + leaf-stamp cards fixed in 3D, chunked).
  A coarse second shadow map covers the whole roam (`shadowFar` in `gl.ts`), so far light matches near light.
  Mira's cottage across the lake (`cottage.ts`) and Mira (`seller.ts`: low-poly 3D pixel-art, anime head, cottagecore
  outfit, ink outline, soft shading). E at her stall opens the shop (`components/play/Shop.tsx`); 4 opens your cases.
  Points are the money (`wallet.ts`, saved in the browser); cases/skins/odds/paint in `loot.ts`; skins paint the 3D
  weapons (`Arms.setSkin`). Case opening is a CS-style reel (`Opening.tsx`). Settings in `settings.ts`.
  Weapons: one texel per screen pixel, warm ramps, ink outline in the composite; the pose holds still and the
  bob/sway/breath move the finished picture by whole pixels (drawn with a margin so no edge shows). Knife: random
  swings, combos on repeated clicks or holding, a spin finisher. The shotgun has iron sights (no crosshair aimed).

## The user's rules (keep this list current)
- Professional, whimsical, hazy-film mood. Not gamey.
- No glow, borders, cards, glassmorphism, eyebrows, dots, live clocks. No notice board (removed on request).
- Picking a disc dives INTO the screen: everything about the project is on the screen as one connected page (title
  top, video left, description right, nav bottom). Never a separate overlay or a sheet floating apart from it.
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
  scroll goes on at once. Scrolling back up never catches. A finger's swipe or fling is caught too (next touch goes on).
- Nothing in the page may be wider than the screen (a phone then loads zoomed out and the walk is measured wrong).
- Phones (iOS worst): full-screen sticky stages are `100lvh + --bleed` (120px) tall, so the next section never shows
  under them, not when the bar slides away and not behind iOS's floating see-through bar (which shows the page
  further down than lvh). What's on them keeps to the top `100svh`. The forest canvas mirrors itself downward
  (`-webkit-box-reflect`) so behind the bar there's wood, not a flat band. Scroll maths for a stage measure the
  stage, not `innerHeight` (it changes with the bar). The clearing's measuring strip (`.work-stick`) stays svh.
- Pill mode menus (Esc, shop, cases) are the page's doodles on paper: pale paper, pen outline, hatched shadow, gingham
  tape, dark ink text, pixel touches. Readability first. No key-hint lines above the hotbar, no arrow/tutorial to Mira.
- Buttons (page, screen, menus): pale paper, pixel ink outline; on hover they grow pixel moss with flowers. Dark
  buttons stay dark on hover (deep moss green), never pale.
- Weapon pixels must never crawl or swim; nothing may show a cut edge when the weapon moves.
- Footsteps: one soft grass step (snow in winter), once per stride.
- The About section has a stay: its words hold still (sticky) a while before the tech stack's paper rises over them.
- Tech stack (`components/site/Crew.tsx`): 3D & motion, Everyday apps, Servers & data, Mods & hardware. WebGL, GLSL,
  React Three Fiber, Ollama, Kotlin, Fabric, Shaders and Physics were taken out on request; don't bring them back.
- Pill mode is entered only by the console command `Enter.PillMode()`; the cat doesn't hold out her paw. The console's
  list of secrets (shown when DevTools opens) leaves out the money cheat.

## Scripts
- `npm run dev`, `npm run build`, `npm run lint` (tsc).
- `npm run screens` makes tiny screen images from `assets/work` (unused while the monitor plays the real videos).
