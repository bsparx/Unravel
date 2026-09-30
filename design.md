# Unravel design foundation

Unravel is a personal habit, calendar, and productivity app. Its first job is
to feel calming, relaxing, and easy to use. Beauty comes from legible type,
balanced space, deliberate hierarchy, and the existing theme atmosphere.

**Make the next action obvious and make time visible.** Give attention a place
to land before showing the surrounding plan. A small habit counts. Rest is a
peer of work. A finished day can settle without a celebration.

## The anchors

`index.html` is one long, interactive component specimen; this file explains
the decisions it demonstrates. Today, Habits, Calendar, Timer, and Components
link to sections on that page. They are specimen anchors, not new app routes.
Sample tasks, check-ins, and calendar blocks stay in memory. Reloading restores
the examples; these interactions do not write to the live app.

`design-notes.md` retains the implementation history. Earlier entries describe
earlier designs; this foundation takes precedence where they differ.
`app/globals.css` holds the shipping palette, `lib/fonts.ts` the font setup,
and `lib/theme.ts` plus `components/theme-script.tsx` the theme behaviour.
The live app now applies the shared type scale, control sizes, theme roles,
and Calendar, Habits, Identities, Today, and Timer refinements described below.
The specimen remains a local example; it does not mirror your account data.

Use the existing Tailwind v4 and owned shadcn/Radix components in the app, with
its existing Lucide icon family. The standalone specimen uses native HTML/CSS
and local assets. It is an honest component preview, not a screenshot made
from decorative rectangles.

## Direction and restraint

This is a refinement of the current brand. Dark mode already works well:
keep its colours, gradients, and atmosphere. Improve type roles, spacing,
surface hierarchy, and the clarity of actions.

| Dial | Value | Practical consequence |
| --- | --- | --- |
| `DESIGN_VARIANCE` | 5 | A clear reading order with modest variation in panel size |
| `MOTION_INTENSITY` | 2 | Still by default; brief feedback follows an action |
| `VISUAL_DENSITY` | 3 | Generous group spacing; optional detail opens when needed |

## Three themes, one component system

| Role | Light | Dark | Eggplant |
| --- | --- | --- | --- |
| Background | `#f7f2fb` | `#060a19` | `#0b0811` |
| Foreground | `#302637` | `#f1f5ff` | `#ece6dc` |
| Card | `rgba(255,255,255,.68)` | `rgba(12,25,55,.69)` | `#120e1a` |
| Popover | `rgba(255,255,255,.88)` | `rgba(11,21,46,.92)` | `#120e1a` |
| Primary fill | `#654263` | `#3652e9` | `#b089b2` |
| Primary label | `#ffffff` | `#ffffff` | `#1f141f` |
| Accent/action text | `#603b64` | `#a7b8ff` | `#c5a8c8` |
| Secondary text | `#564a60` | `#b2c0dc` | `#a494a8` |
| Focus ring | `#654263` | `#8fa3ff` | `#b089b2` |
| Destructive | `#b34462` | `#ff7c91` | `#d4796a` |

Light uses lilac, blush, and peach washes behind plum actions. Dark keeps the
navy atmosphere and primary gradient from `#284be3` to `#5e31d3`. Eggplant
uses the aubergine atmosphere and mauve fill. Copy the atmosphere definitions
from the shipping CSS without retuning them. Scope the navy gradient to Dark
so it cannot overwrite Eggplant's identity.

**Dark primary is a fill, not a body-text colour.** Keep `#3652e9` for filled
actions; use `#a7b8ff` for action text and `#8fa3ff` for focus rings. Improve
readability through role selection, not by changing the established palette.

| Reserved role | Light | Dark and Eggplant | Meaning |
| --- | --- | --- | --- |
| Running | `#3d5fb2` | `#8aa2f0` | Live work timer or calendar now-line |
| Running wash | `#dde4f8` | `#1c2545` | Supporting a live work timer |
| Recovery | `#66748f` | `#93a0bd` | Rest, labelled explicitly |
| Recovery wash | `#e2e7f0` | `#1b2338` | A recovery block or face |

Planned work uses the primary wash, recovery uses its own wash, and buffer
stays neutral with a dashed edge. Completion uses a check alongside primary
colour. Skipped stays neutral. Never communicate state with colour alone.

Theme choice applies to the whole page and native controls. The app accepts
`light`, `dark`, `eggplant`, and `system`, with storage key `theme`. System
follows `prefers-color-scheme`; Eggplant adds `data-theme="eggplant"` to
`.dark`. The specimen remembers appearance separately under
`unravel-reference-theme`, preserving it when its sample data resets on reload.

## Type that makes the page easier to read

Keep the established typefaces with fewer competing roles:

- **Newsreader:** page headings and the focused task title. It is the existing
  journal-like brand voice, used sparingly.
- **Karla:** section and component headings, navigation, rows, labels, buttons,
  and body text. Use weight and spacing to create hierarchy.
- **JetBrains Mono:** timer digits, durations, dates, and counts. Use tabular
  figures so changing values stay aligned.
- **Caveat:** journal writing and spread headers only. Keep controls and
  instructions in the reading face.

The refined specimen uses **16px body, 14px secondary text, and 12px optional
metadata** as its reading hierarchy. Page headings are 36px on phones and
scale from 36-46px on desktop. Karla section headings use 22-24px; component
headings use 17-19px. A focused task title uses Newsreader at 24-26px. The
timer digits are the deliberate larger exception. The live type tokens now
use 16px body, 14px label, and 12px micro; `font-heading` uses Karla.

Use sentence case, 1.5-1.65 body line height, and a reading width of about
45-65 characters. Avoid tiny uppercase labels above every heading. Give type
room to wrap and preserve italic descenders. Font assets stay local: the app
self-hosts with `next/font`, and the specimen embeds local fonts with swap.

## Space, shape, and surfaces

Use a 4px spacing unit: 8px inside compact groups, 12-16px between related
items, 20-24px panel padding, and 32-40px between major groups. Phones need
at least 16px page gutters and room below content for fixed navigation.

Use a consistent shape for each component role, rather than one radius for
everything. The specimen evolves the app's soft 10px base with these rules:

| Shape | Radius | Role |
| --- | --- | --- |
| Control | 10px | Buttons, inputs, navigation, and day selectors |
| Panel | 20px | Main surfaces and dialogs |
| Agenda item | 12px | Calendar events and transient notices |
| State inset | 16px | Empty, pending, and error specimens inside a panel |
| Checkbox | 7px | Small visible checkboxes and habit-history marks |
| Segmented wrapper | 13px | Outer frame around 10px choice buttons |

The checkbox still sits inside a 44px target. Circular timer faces represent
duration; they are not a new card shape. Small skeleton bars may use a 6px
radius because they preview lines of content, not controls.

The atmosphere is the outer layer. A priority panel can rise above it;
supporting rows can share one surface. Fields have stable fills, while menus
and dialogs have denser fills than cards. Use one soft shadow where elevation
communicates hierarchy. Avoid shadowed cards nested inside shadowed cards.
Glass is a CSS web approximation with opaque fallbacks for unsupported blur
and reduced transparency.

## Component contracts

| Component | Contract |
| --- | --- |
| Next action | Task title, minimum useful step, duration if known, and one clear primary action |
| Habit row | Named small promise, one completion control, optional extra, and quiet history |
| Calendar | Clear date/time labels, explicit today, kind-labelled blocks, and a readable selected-day agenda |
| Timer | Task and timer dominate; start/pause/resume stay in one place; idle and paused faces stay still |
| Button | Short single-line verb; primary, secondary, quiet, destructive, pending, and disabled states |
| Field | Label above, helper and connected inline error below; preserve the draft on failure |
| Empty state | Say what is empty and offer one useful next action |
| Loading state | Match the final layout with a skeleton and an accessible pending label |
| Error state | Explain the problem and offer a specific retry or correction |

Everyday controls have **at least a 44px hit area**, including small visible
icons. Row actions stay available on touch. A checked habit settles into a
readable completed state with an undo path where appropriate. Optional extra
progress never becomes a second target to fail. Recovery gets equal clarity
without a draining countdown.

## Navigation and responsiveness

Keep the production app's established labels and destinations. The desktop
rail and mobile bottom bar retain Today, Day, Calendar, Timer, and Exercises;
the other existing destinations stay available in the rail. The specimen's
Today, Habits, Calendar, Timer, and Components anchors organise this reference
page without changing the app's navigation.

Read in this order: heading, immediate action, surrounding plan. At wider
sizes supporting context can sit beside the action; below 768px it follows
underneath. Calendar grids may scroll within their own container. The page
must fit a phone without horizontal overflow. Keep primary controls visible
and avoid hiding necessary actions until hover.

## Adopted component improvements

The specimen demonstrates the visual hierarchy and local interaction patterns.
The live components now apply these changes while retaining the existing
routes, data model, completion rules, and timer measurement.

**Calendar:** retain the existing **day default** and offer week on request.
For an optional mobile week view, use a compact day selector followed by the
selected day's time grid and agenda. Give blocks an explicit **Details** action reachable
by keyboard and touch. Expand resize and drag targets invisibly rather than
making the visible handles louder. Soften minor grid rules while keeping real
gaps, block-kind treatments, prayer bands, and the now-line distinct.

**Habits:** make the minimum promise and completion checkbox the row's first
read. Give timer entry a named **Start** action instead of relying on a
clickable title. Group **Due today** separately from **Other days**. Put edit
and archive under a visible **More** menu so rare actions do not compete with
daily completion. Preserve the existing cue and collapsed history; each
heatmap day should reveal its date and outcome on keyboard focus or press,
without requiring hover or colour interpretation.

**Identities:** lead each identity with its name, statement, and one vote
summary. Put additional analytics behind a disclosure rather than repeating
them above and inside the card. Keep habit links live and provide a contextual
action that leads to the next useful evidence. Fold **Needs focus** into the
relevant identity card instead of repeating it in a second list. A skipped day
or planned rest remains neutral, with no failure language.

**Today:** retain the morning choice and single selected task, including its
frog illustration. Show the minimum next step in Karla, allow titles to wrap,
and keep secondary navigation quiet but comfortably reachable.

**Timer:** preserve the real clock, depletion renderer, recovery count-up,
interval logic, and session persistence. Keep Start/Pause/Resume in one place.
Move idle duration and interval settings behind a disclosure below Start; use
ordinary pressed buttons for mode selection, with a two-column phone layout.
Remove the extra ambient glow.

**Shared controls:** use 44px button and field targets, visible labels, stable
field fills, scrollable dialogs, and a 44px checkbox hit area around the 21px
mark. Preserve all three palettes; restrict the navy primary gradient to Dark.
The mobile bar keeps its established routes and accommodates safe-area insets.
Save notifications appear at the top so they do not cover bottom navigation
or the capture action.

## Motion, accessibility, and language

Use brief hover, press, and state-change feedback. No decorative loops,
parallax, automatic carousels, or celebration effects. Honour reduced motion.
An action in flight is state, not decoration: labelled buttons take `loading`
(spinner, full opacity), small controls get the orbit ring, and nothing shows
for the first ~150ms so fast actions never flash. Under reduced motion each
leaves a still frame behind.
The live timer's depletion conveys time; the detailed rendering and recovery
contracts remain recorded in `design-notes.md`.

Check contrast against the composited glass and the strongest part of the
atmosphere. Body, placeholders, labels, and button text need at least 4.5:1;
large text and focus indicators need 3:1. Keep native keyboard behaviour,
visible focus, accessible names, and polite saved-state announcements.
Calendar rescheduling requires a keyboard and tap alternative to dragging.

Use direct, gentle copy: "Start", "Pause", "Add habit", "Nothing planned",
and "Try again". Say what happened and what the person can do next. Avoid
guilt, manufactured urgency, streak-loss threats, decorative scores, and
performative encouragement.

## Before adopting a new component

Check all three themes, desktop and phone layouts, keyboard operation, and
reduced motion. Check the empty, pending, error, completed, and disabled states
that apply. Keep one visually primary action per group and verify that labels
remain legible and controls remain reachable. Update both anchors whenever a
component rule changes.
