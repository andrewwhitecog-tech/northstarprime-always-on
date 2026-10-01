---
version: obsidian-signal-2026-09-30
colors:
  primary: "#edca83"
  night: "#080c16"
  surface: "#111827"
  ink: "#f4eee0"
  muted: "#b7becd"
  gold: "#edca83"
  aurora: "#9ae5df"
  line: "#354153"
typography:
  display:
    fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif'
  body:
    fontFamily: '"Segoe UI", system-ui, sans-serif'
rounded:
  card: "6px"
omitted:
  - section: spacing
    reason: "Responsive CSS clamp values are canonical in static/customer-experience.css."
  - section: components
    reason: "Static HTML uses shared documented class primitives rather than a component library."
---

## Overview

NorthStar Prime is an independent entertainment destination. The first visit is Listen, Play, Watch, with complete guest experiences. Preserve its VORATH cosmic night, luminous gold and aurora, original photographic/painterly assets. The distinctive opening is a still full-color cosmic signal beside large, calm typography; no autoplaying wallpaper, cascading dashboards, status counters or megamenu.

This is a brand/content shell, with application behavior isolated in the radio and games. Mystery School has an independent front door and visual treatment in its own directory. RenalShield is a separate health product and does not inherit this theme. NorthStar Digital uses the quieter institutional variant and its own name/navigation.

## Colors

Model B: runtime CSS is canonical. The frontmatter mirrors `static/customer-experience.css` variables `--night`, `--surface`, `--ink`, `--muted`, `--gold`, `--aurora`, `--line`. All new shared pages consume that stylesheet. Institutional variants are owned by `.institutional` in the same file: night #0b1822, surface #132432, ink #f4f1e8, muted #bdcbd2, primary #bee0eb, accent #e4c88c, line #3c5363. Never use color alone to communicate status.

## Typography

Palatino's book-like display shapes connect original stories and the mystery-school tradition; Segoe UI supplies clear system-native reading and controls without font downloads. Display type is reserved for page and section headings. Plain verbs label actions. No lore vocabulary in a control whose job is listening, playing, buying, or contacting support.

## Layout

Maximum 1240px, 32px outer desktop margin and 18px phone margin; natural document scrolling. Desktop hero pairs the visitor promise with existing still art. Three experience cards become one column on phones. Main navigation remains visible, with no hover-only menu. Reserve image aspect ratios. No required animation, countdown or forced enrollment.

## Elevation & Depth

Original art carries depth; obsidian glass panels use restrained engraved-gold top edges and polished straight borders. Gradients belong to artwork framing or the institutional hero, not every component. No constant background video, parallax, canvas effects or pulsing CTA.

## Shapes

6px panel radius; 4px action links with a 48px minimum height. Gold primary, outlined secondary. A visible aqua focus ring is shared. Card rows align through grid, without fixed copy heights that clip long titles.

## Components

Shared classes: `.site-header`, `.wordmark`, `.button`, `.cards`, `.card`, `.section`, `.paths`, `.note`, `.site-footer`. Root and `/access/`, `/arcade/`, `/arcade/lab/` share the entertainment vocabulary. `/hire/` has the institutional class and a business-specific navigation. Links always name the destination; paid products explain scope and fulfillment before payment. Native disclosure is used for FAQ, with visible keyboard focus.

## Do's and Don'ts

Do provide complete free experiences and honest optional paid value. Institutional work is the principal commercial direction; consumers are not pressured to support the project. Do preserve all existing content routes and distinguish experiments from featured games. Do use the existing contact address for project inquiries, without sending messages automatically. Don't invent clients, certifications, outcomes, active checkout or a current subsidy fund. Don't describe symbolic reflection as treatment or scientific proof. Respect reduced motion and forced colors; no automatic sound.

## Interaction ownership and audit scope

IDR owns its native genre select, native audio controls and JavaScript-wired buttons. Mystery School owns native buttons, labeled textareas and details in its controller. The automated literal-markup audit cannot follow their addEventListener bindings; real controller tests and browser Enter-key journeys verify those actions. Mystery textareas intentionally permit vertical resizing for long optional notes, without horizontal resizing. Static brand pages have no authored menu, dialog, data table or custom select. Family readers reuse the established native text controls in little-light-library/library.js, with contained navigation.

The full-repository premium audit includes legacy games and generated libraries outside this changed shell; its findings are triaged in the private release record, not dismissed as a repository-wide pass.


## Obsidian Signal material update — 2026-09-30

Owner direction: black glass, crisp white text, high contrast, purposeful color, and a distinct futuristic VORATH identity; never a generic phone interface. The appended Obsidian Signal layer in `static/customer-experience.css` is canonical and overrides older frontmatter color examples. System dark appearance uses near-black #050608, white #f8fafc, gold #e8c77d and restrained aqua #8bd9df. System light appearance switches to a readable pale mineral surface with dark ink, dark gold and teal; original art retains full color. No appearance preference is stored or forced.

Cards have 6px corners and actions 4px corners, with subtle engraved edges, dense smoked surfaces and restrained depth. Gold marks primary actions and the brand; aqua marks focus and secondary emphasis. Status colors must always be paired with explicit labels. Avoid frosted white blobs, giant pills, repeated rainbow gradients, ornamental fake dashboards and obscured text. Display typography remains editorial Palatino, with clear Segoe UI controls, so VORATH retains its story-world character.

The hero now reserves a large independent artwork panel beside copy on desktop and below it on phones. It is never dim wallpaper behind text. The institutional variant retains quieter blue-steel accents and its own navigation. Reduced motion, reduced transparency, forced colors and print are accommodated; browser review remains necessary before release.

Coverage: this shared sheet updates only pages that actually load it. IDR, store, IDC and other independent styles need their own integration and checks; this change alone is not an all-sites rollout. Existing inline legacy card backgrounds are intentionally replaced by the material layer to preserve contrast in both appearances.
