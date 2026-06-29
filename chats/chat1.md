# Frontend tagging requirements

_Started 2026-06-29 02:30 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Untitled"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 uploads
Current date is now June 29, 2026
</system-info>

<default aesthetic_system_instructions>
The user has not attached a design system. If they have ALSO not attached references or art direction, and the project is empty, you must ASK the user what visual aesthetic they want. Use the questions_v2 tool to ask about preferred vibe, audience, colors, type, mood, etc. Do NOT just pick your own visual aesthetic without getting the user's aesthetic input -- this is how you get slop!

Once answered, use this guidance when creating designs:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic_system_instructions>

<attached_files>
- uploads/ui-design-prompts.txt
</attached_files>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design Components">
This project uses Design Components: every design is a single streaming `Name.dc.html` file. The full authoring spec is in your system prompt under "Writing code — Design Components" — follow it. Author and edit `.dc.html` content with the `dc_write`, `dc_html_str_replace`, `dc_js_str_replace`, and `dc_set_props` tools (not `write_file`; `str_replace_edit` works but won't stream); template edits stream into the live preview as you type.
</attached-skill>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: read_file]_

_[tool: set_project_title]_

I'll build all 6 screens (+ the 2-hour warning overlay) as a single Design Component in canvas mode so you can see them side-by-side.

_[tool: dc_write]_

_[tool: ready_for_verification]_

Built all six screens plus the 2‑hour warning overlay as a single canvas — Home, Active SET, Active BREAK (overtime state), Workout Complete, History (with one row expanded), Settings, and the warning modal.

Notes:
- The SET timer ring uses a static fill (~78%) and the BREAK frame shows the overtime variant (red ring empty, red `+0:45` counter). Phase animations and slider drags are visual stand‑ins — meant as design specs, not a live timer.
- AMRAP variant of Screen 2 isn't broken out — say the word if you want it as a 7th frame.
- Pan around the canvas to navigate between screens.

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Design prompts file"
User is viewing file: Workout Timer.dc.html
</system-info>

<attached_files>
- uploads/implementation-plan.html
- uploads/CLAUDE.md
- uploads/app-spec.json
</attached_files>

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Thanks — these give the full picture. I noticed the Monday programme in my mock didn't match the spec (T1 should be Flat Barbell Bench Press, only one T1 per day, and the AMRAP exercise needs a distinct marker). Let me sync the data to the spec and save CLAUDE.md to the project root so it persists across sessions.

_[tool: copy_files]_

Now update the data inside the DC to match the spec — Monday's actual programme (Flat Barbell Bench Press as the lone T1, Ab Roller as the AMRAP), and propagate the active exercise name through the workout/break/warning frames and the session summary.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Synced to the spec:
- Monday programme uses the actual exercises (Flat Barbell Bench Press as the one T1, Ab Roller as the AMRAP "Failure" set).
- SET / BREAK frames now show Flat Barbell Bench Press as the active T1.
- Complete‑screen breakdown and History expanded detail use the real exercises.
- 2‑hour warning frame's background exercise switched to Preacher Curls (plausible final‑hour set).
- Saved CLAUDE.md to project root so the context (palette, programme, timer rules) persists in future sessions.

Tell me when you want the AMRAP variant of the SET screen (spinning ring, "GO" centre) drawn as its own frame, or the rest‑day Home state, or Tuesday/Thursday/Friday days swapped in.

## User

Do what you think is best please make sure to tag all the buttons, pages and features to let the back end know where to attach what

## Assistant

I'll do two things together: add the two missing frames (Rest‑Day Home + AMRAP variant of the Active screen) and tag every screen, button, action, and bound value with `data-*` attributes so the backend (or Claude Code) can wire handlers and bindings deterministically.

Tagging scheme:
- `data-screen` / `data-route` on each screen root
- `data-action` on every tappable element (matches store action names)
- `data-bind` on every dynamic value
- `data-feature` on major UI features (circular timer, set dots, segmented controls, etc.)
- `data-phase` on timer states (set / break / overtime / amrap / timed)
- `data-setting` on each Settings control, mapped to the `UserSettings` key

_[tool: dc_write]_

Now a quick reference doc that maps every tag to the store action / data binding in the implementation plan — so the backend dev sees one canonical list:

_[tool: write_file]_

_[tool: ready_for_verification]_

## Assistant

The previous turn actually completed cleanly — both deliverables are in place:

1. **Workout Timer.dc.html** now has all 9 frames:
   - 01 Home (has_workout) · 02 Active SET · 03 Active BREAK (overtime)
   - 04 Complete · 05 History · 06 Settings
   - 07 2‑hour warning overlay · 08 Home (Rest Day) · 09 Active AMRAP
   Every screen, button, dynamic value, and Settings control carries `data-screen`, `data-route`, `data-state`, `data-phase`, `data-action`, `data-bind`, `data-feature`, and `data-setting` attributes.

2. **backend-wiring.md** at the project root — the cross‑reference doc mapping every `data-action` to a Zustand store call / router navigation, every `data-bind` to its source in the workout / session / settings state, and every `data-setting` to its `UserSettings` key.

Nothing left in the queue from "do what you think is best." If you want next: a TIMED‑exercise frame (Plank 60s countdown), a Cardio "skipped" placeholder, an "abandon workout" confirmation dialog, or Tuesday/Thursday/Friday day variants — say the word.

## User

resume

## Assistant

Everything from the plan is already complete and saved — there is nothing pending to resume.

State of the project right now:
- `Workout Timer.dc.html` — 9 frames, fully tagged with `data-screen` / `data-route` / `data-action` / `data-bind` / `data-feature` / `data-setting`.
- `backend-wiring.md` — backend reference doc mapping every tag to its store action / binding.
- `CLAUDE.md` — project context at the root.

Safe stopping point. Send a new instruction (e.g. TIMED frame, abandon-confirm dialog, Tue/Thu/Fri day variants) when you're ready.

## User

Create a .md file for the back end builder to understand how to attach the back end to the front end in relation to all the resources I provided you earlier so that the back end builder can go in to the github repo where we will push everything too and use what we provide to build that backend and attach it to the front end

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: write_file]_

_[tool: show_to_user]_

`backend-integration-guide.md` is at the project root. It's structured so the backend builder reads it top-to-bottom and ends up with a clear build path:

1. What "backend" means here (local data layer — no server, no auth, no cloud)
2. Resource map — which of the other files (`app-spec.json`, `CLAUDE.md`, `implementation-plan.html`, `backend-wiring.md`, `Workout Timer.dc.html`) to read for what
3. Locked stack and file layout
4. How the tagged design connects to the code — `data-screen`/`data-action`/`data-bind`/`data-setting` rules
5. Data entities — pointer to `app-spec.json` as source of truth
6. Store API — every `data-action` mapped to a store function
7. Bindings — every `data-bind` mapped to its source path, grouped by screen
8. Exact timer rules (SET counts up + overtime, BREAK counts down + overtime turns red, AMRAP, TIMED, CARDIO skip, 2hr warning, keep-awake)
9. Animated ring constants and per-phase colour table
10. Learning algorithm spec
11. The three AsyncStorage keys
12. Build / CI (keystore, secrets, workflow location)
13. Phase order to build in
14. Per-screen acceptance checklist

When you push to GitHub, the four files the backend builder needs are: `Workout Timer.dc.html`, `backend-integration-guide.md`, `backend-wiring.md`, `CLAUDE.md`, plus the `uploads/` folder (`app-spec.json`, `implementation-plan.html`, `ui-design-prompts.txt`). I'd suggest moving the three upload files out of `uploads/` and into a top-level `spec/` folder before the push so they're easier to find. Want me to do that?

## User

yes also add these to the spec folder some might be copies but rather than miss any i thought i would post all

## Assistant

_[tool: run_script]_

All four are byte-identical duplicates. I'll put one canonical copy of each into `spec/` with clean names, then update the integration guide's resource map to point there.

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: write_file]_

## Assistant

Done. Project layout is now:

```
/ (repo root)
├── Workout Timer.dc.html         ← tagged design
├── backend-integration-guide.md  ← main doc for the backend builder
├── backend-wiring.md             ← tag-by-tag reference
├── CLAUDE.md                     ← auto-loaded project context
└── spec/
    ├── app-spec.json
    ├── CLAUDE.md
    ├── implementation-plan.html
    └── ui-design-prompts.txt
```

The four uploaded duplicates were byte‑identical to the originals, so I copied one canonical version of each into `spec/` and updated the resource map in `backend-integration-guide.md` to point there. `CLAUDE.md` stays at the repo root too because some tooling (including Claude Code) auto‑loads it from there.

Safe to push to GitHub.

