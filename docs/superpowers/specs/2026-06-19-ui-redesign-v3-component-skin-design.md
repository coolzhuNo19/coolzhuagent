# UI Redesign V3 Component Skin Design

## Objective

Continue the approved wuxia bamboo, ink-green glass and restrained metal redesign at the component level. Replace the remaining mixed visual language across text fields, borders, buttons, switches, selectors, functional icons and session avatars without changing window geometry, backend APIs or active frontend hooks.

This is a visual-system increment to the approved V3 layout. It does not redesign window structure or the Memory/Knowledge backend.

## Visual direction

- Main surfaces use translucent ink-green glass over a near-black base.
- Borders use muted gunmetal and jade; gold is reserved for active navigation and primary actions.
- Inputs must look recessed rather than raised.
- Buttons must expose distinct default, hover, pressed, disabled, primary and danger states.
- Icons use one crisp vector language rather than mixed pixel-art sources.
- Human/agent portraits use one desktop-pet-style chibi wuxia family.
- No text is baked into component assets.

## Component architecture

### Component skin tokens

Add one final-precedence token layer in `src/styles.css`:

- `--control-surface`
- `--control-surface-hover`
- `--control-border`
- `--control-border-focus`
- `--control-inner-highlight`
- `--control-shadow`
- `--control-radius`
- `--control-icon-size`
- `--avatar-frame-size`

All inputs, textareas and selects share the recessed glass surface. Buttons share the raised metal surface but specialize through semantic classes and existing classes such as `.send`, `.danger`, `.is-active` and `[aria-pressed="true"]`.

### Inputs and selectors

- Text input and textarea: dark ink glass, 1px steel/jade border, inset top highlight and bottom shadow.
- Focus: jade outer glow plus visible keyboard outline.
- Invalid/error: red border only when the existing state class or ARIA state requests it.
- Select: same surface plus a small code-native chevron; no generated bitmap arrow.
- Checkbox/toggle: square or pill metal housing with jade active lamp.
- Placeholder text stays legible but visually secondary.

### Buttons

- Secondary: gunmetal frame with muted jade edge.
- Primary: restrained warm-gold frame and jade/gold icon accent.
- Danger: dark red edge; avoid full bright-red fill except pressed/critical confirmation.
- Icon-only buttons remain at least 32px hit size.
- Disabled controls reduce saturation and contrast without hiding their label.

### Panel borders

- Use CSS gradients and inset shadows rather than new bitmap nine-slice frames.
- Remove excessive stacked gold rings.
- Cards and command rails get a thin jade-steel border; active/focused panels may add a subtle gold top edge.
- The result must remain sharp at different WebView scales.

## Functional icon system

Create `assets/icons-wuxia/` as a deterministic SVG set. Each file uses:

- `viewBox="0 0 24 24"`
- rounded 1.7px strokes
- pale jade primary stroke/fill
- restrained gold accent
- no text, shadows or raster effects

Initial required icons:

- project, settings, chat, browser, media
- terminal, tasks, memory, vision, logs
- refresh, search, save, delete, link
- send, microphone, upload, lock, unlock
- camera, diff, folder, file, chevron

The dock and high-frequency primary controls switch to the new set. Less visible legacy icons remain temporarily compatible and receive the shared icon holder/filter until migrated.

## Avatar system

Generate a coherent set of eight desktop-pet-style chibi wuxia portraits using the existing `wuxia-swordsman.png` as style and scale reference:

1. 竹林少侠
2. 羽林女侠
3. 青衣谋士
4. 金甲指挥使
5. 墨衣影卫
6. 云游医师
7. 机关巧匠
8. 藏经僧

Constraints:

- square portrait composition
- consistent head/body scale and baseline
- dark ink-green circular or rounded background
- white/grey/ink-green clothing family with small gold accents
- no text, watermark or modern objects
- characters remain readable at 32px and 48px

The generated source sheet is versioned. Individual portrait files are cropped non-destructively into `assets/avatars/wuxia-v3/`.

`assets/avatars/manifest.json` lists the new set first. Existing saved legacy avatar filenames are mapped to the closest new portrait in frontend compatibility code, so an existing session does not render a broken image.

## Accessibility and compatibility

- Preserve all `data-action`, `data-role`, `data-bind`, `aria-*` and form semantics.
- Preserve the Browser iframe sandbox.
- Maintain visible `:focus-visible` outlines.
- Do not use color alone for disabled, selected or dangerous state.
- Do not add environment variables or backend configuration.
- Do not stretch avatar images or change their aspect ratio.

## Minimal TDD strategy

Add one frontend static contract that proves:

- the component token layer exists;
- primary form controls use the new component scope;
- the dock references `icons-wuxia`;
- the avatar manifest exposes the new `wuxia-v3` set;
- legacy avatar mapping exists;
- existing data hooks remain present.

The test must fail before implementation and pass afterward. Functional acceptance uses Computer Use on the packaged Tauri frontend.

## Computer Use acceptance

Verify at least:

1. Chat composer input, attach, send and voice controls.
2. Settings inputs/selects, avatar picker and primary/danger buttons.
3. Project search/Diff controls and dock icons.
4. Task permission fields, full-access buttons and module self-check controls.
5. Keyboard focus visibility while tabbing.
6. Avatar rendering in the overview card, channel roster and message list.

## Rollback

Back up:

- `index.html`
- `src/styles.css`
- `src/app.js`
- `src/main.rs`
- `assets/avatars/manifest.json`
- `assets/icons-wuxia/` if it already exists

The backup manifest must include SHA-256 values and be stored under `tmp/backups/<timestamp>-ui-component-skin-pre/`.

