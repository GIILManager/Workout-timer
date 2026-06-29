# Backend Integration Guide — Workout Timer

> **For the backend builder.** This document is the bridge between the resources in this repo and the tagged design (`Workout Timer.dc.html`). Read this first, then `spec/app-spec.json`, `spec/CLAUDE.md`, and `spec/implementation-plan.html` in that order. The frontend design is already tagged so every action and binding has a known wiring point — your job is to make those tags do real work.

---

## 1. What "backend" means in this project

**There is no remote server.** This is a personal Android-only app. The "backend" you are building is the **local data layer** that lives inside the app process:

1. **Zustand stores** that hold runtime state (active workout) and persisted state (history + settings).
2. **AsyncStorage** as the persistence engine (3 keys only).
3. **Hooks** that drive the timer loop, screen-wake, alerts, and 2-hour warning.
4. **Pure utility functions** that compute adapted timings from history.

No HTTP, no auth, no cloud sync, no database. All user data stays on device.

---

## 2. Resource map — what to read for what

| File | What it tells you |
|---|---|
| `Workout Timer.dc.html` | The frontend design with `data-*` tags. Every screen, button, dynamic value, and setting is labelled. |
| `backend-wiring.md` | Cross-reference: every `data-action` → store call, every `data-bind` → state path, every `data-setting` → `UserSettings` key. **Use this as the integration checklist.** |
| `spec/app-spec.json` | The contract. Entity shapes, screens, programme data, AsyncStorage keys, GitHub Actions config. |
| `spec/CLAUDE.md` | Product rules: timer behaviour (count up vs down, overtime), learning algorithm, design palette, file structure, build target. (Also at the repo root as `CLAUDE.md` for tooling that auto-loads it.) |
| `spec/implementation-plan.html` | Phase-by-phase build plan with ready-to-paste source for types, stores, hooks, screens, and CI. |
| `spec/ui-design-prompts.txt` | Original screen-by-screen UX descriptions — useful when the design's intent for a component is unclear. |

---

## 3. Stack (non-negotiable)

```
Expo SDK 53 (managed + prebuild)
Expo Router 4               file-based routing under app/
React Native Reanimated 3   timer ring animation
react-native-svg            the SVG ring itself
Zustand                     state management
@react-native-async-storage/async-storage
expo-keep-awake             screen on during workout
expo-haptics                vibration alerts
expo-av                     sound alerts
TypeScript strict mode
```

Build target: **Android APK only**, built via GitHub Actions (`expo prebuild` + Gradle). No EAS cloud. Artifact is downloaded from the Actions tab.

---

## 4. Repo / file layout

```
src/
├── data/workouts.ts          ← hardcoded 4-day programme from app-spec.json
├── store/
│   ├── workoutStore.ts       ← active session (NOT persisted, in-memory)
│   └── historyStore.ts       ← settings + timing records + sessions (AsyncStorage)
├── hooks/
│   ├── useTimer.ts           ← THE timer loop (setInterval + Reanimated SharedValue)
│   ├── useWorkoutDuration.ts ← total elapsed clock + 2-hour warning trigger
│   └── (others)
├── utils/
│   ├── timing.ts             ← getAdaptedTiming(), estimateTotalDuration(), formatters
│   ├── alertService.ts       ← haptics + expo-av sound (2s buzz then silent)
│   └── time.ts               ← formatTime, formatElapsed, formatHoursMinutes
├── types/index.ts            ← every interface in app-spec.json entities
└── components/               ← reusable UI (CircularTimer, SetDots, …)

app/                          ← Expo Router screens
├── _layout.tsx               ← hydrate stores in useEffect on mount
├── index.tsx                 ← Home          (data-screen="home")
├── workout/index.tsx         ← Active        (data-screen="workout")
├── complete.tsx              ← Complete      (data-screen="complete")
├── history.tsx               ← History       (data-screen="history")
└── settings.tsx              ← Settings      (data-screen="settings")
```

**Rule:** never import from `app/` inside `src/`. One-way dependency.

---

## 5. How the design connects to the code

The design is a single `.dc.html` file with 9 frames showing every screen variant. Every meaningful element carries `data-*` attributes that name its role. You don't render the `.dc.html` in the app — it's a **specification**. Translate frame-by-frame into React Native, preserving the data tags as a comment or just using them as a mental checklist that all wiring is done.

### Tag → wiring rules

| Tag | What it means for you |
|---|---|
| `data-screen="<name>"` | A screen file under `app/`. One file per unique screen name. |
| `data-route="<path>"` | The Expo Router path. `router.push(path)` to land here. |
| `data-state="<variant>"` | A conditional render inside the screen (e.g. `has_workout` vs `rest_day`). |
| `data-phase="<set\|break\|amrap\|timed>"` | Which branch of the workout screen renders. Read from `workoutStore.currentPhase`. |
| `data-overlay="two-hour-warning"` | A modal layered over the workout screen. Visible when `useWorkoutDuration().shouldShowWarning && !warningDismissed`. |
| `data-action="<name>"` | A tappable element. Wire its `onPress` to the handler named below in §7. |
| `data-bind="<path>"` | A dynamic value. Read it from the store / hook path below in §8. |
| `data-setting="<UserSettings key>"` | A control that writes to `UserSettings`. Wire to `historyStore.updateSettings({[key]: value})`. |
| `data-value="<literal>"` | The committed value of a segmented-control segment. |
| `data-feature="<name>"` | Informational only — useful for grouping styles or for analytics, no handler required. |

Open `backend-wiring.md` for the full list. If any element is missing a tag you need, add it to the design — don't guess.

---

## 6. Data entities — single source of truth

All shapes are defined in **`spec/app-spec.json` → `entities`**. Mirror them verbatim into `src/types/index.ts` (the implementation plan has ready-to-paste source). Quick recap:

- `Exercise` — `id`, `name`, `type ('TIER1'|'STANDARD'|'AMRAP'|'TIMED'|'CARDIO')`, `sets`, `reps`.
- `WorkoutDay` — `day`, `dayOfWeek (1=Mon, 2=Tue, 4=Thu, 5=Fri)`, `name`, `muscleGroups`, `exercises[]`.
- `TimingRecord` — one per completed set; feeds the learning algorithm.
- `SetRecord` — what actually happened during the live session (predicted vs actual).
- `WorkoutSession` — a finished session: `id`, `day`, `date`, `totalDuration`, `setRecords[]`.
- `UserSettings` — the 7 tunables (4 durations + target/warning workout minutes + minSessionsForAdaptation).

Defaults are exactly the values in `spec/app-spec.json` → `entities.UserSettings` and `entities.TimingDefaults`.

---

## 7. Store API — what every `data-action` calls

`Workout Timer.dc.html` uses these action names. Each maps 1:1 to a store call or router navigation. The implementation plan has the full store source.

### `workoutStore` (in-memory, NOT persisted)

| Action tag | Function | Behaviour |
|---|---|---|
| `start-workout` | `startWorkout(workout, sessionId)` | Sets `activeWorkout`, `sessionId = uuid.v4()`, `sessionStartedAt = Date.now()`, `currentExerciseIndex = 0`, `currentSetNumber = 1`. Then immediately call `startSet(timing.setDuration)`. |
| `complete-set` | (caller logic, see implementation plan §3) | Stop alert; compute `actualSetDuration = (Date.now() - phaseStartedAt) / 1000`; push a partial `SetRecord` + partial `TimingRecord`; call `startBreak(timing.breakDuration)`. AMRAP: same, but `setDuration: null`. |
| `start-next-set` | `completeBreak(actualBreakDuration)` then either `startSet(...)` or advance to `/complete` | Stop alert; update the last `TimingRecord.breakDuration`; if more sets remain on this exercise, `startSet`. Otherwise advance to next exercise (skipping `CARDIO`). When done, save the `WorkoutSession`, then `abandonWorkout()` to reset, then `router.replace('/complete')`. |
| `skip-break` | `skipBreak()` | Same path as above, but commits `actualBreakDuration = 0`. |
| `abandon-workout` | `abandonWorkout()` | Reset everything. Wrap in a confirmation `Alert.alert`. |
| `dismiss-warning` | `dismissWarning()` | Sets `warningDismissed = true` for the rest of the session. |

Store also tracks: `currentPhase: TimerPhase`, `phaseStartedAt: number`, `targetDuration: number`, `warningDismissed: boolean`.

### `historyStore` (persisted to AsyncStorage)

| Action tag | Function |
|---|---|
| `update-setting` | `updateSettings({ [key]: value })` — `key` is the element's `data-setting`, `value` is `data-value` (segmented) or the slider's committed value. |
| `reset-learning` | `resetLearning()` — clears `timingRecords` only; keeps `sessions` and `settings`. Wrap in confirmation `Alert.alert`. |
| (called by `complete-set` flow) | `addTimingRecord(record)`, `addSetRecord(record)`, `saveSession(session)` — see implementation plan §1.4 for signatures. |
| (on app start) | `hydrate()` — load all three AsyncStorage keys into the store. Call inside `useEffect` in `app/_layout.tsx`. |

### Router

| Action tag | Call |
|---|---|
| `navigate-history` | `router.push('/history')` |
| `navigate-settings` | `router.push('/settings')` |
| `navigate-home` | `router.replace('/')` (used by Complete screen's DONE) |
| `go-back` | `router.back()` |
| `navigate-exercise-detail` | No detail screen specced. Either no-op or future route. |

### UI-local action

| Action tag | Behaviour |
|---|---|
| `toggle-session-expanded` | Local component state on the History screen: toggle `expandedSessionId`. Wrap mutation in `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`. |

---

## 8. Bindings — what every `data-bind` reads

Group by screen. Each path resolves against the indicated source.

### Home (`data-screen="home"`)
| `data-bind` | Source |
|---|---|
| `workout.day.name` | `getTodayWorkout()?.name` uppercase. (`null` for rest day → render the `rest_day` variant.) |
| `workout.muscleGroups` | `getTodayWorkout()?.muscleGroups` |
| `workout.exerciseCount` | `workout.exercises.length` |
| `workout.estimatedDurationFormatted` | `estimateTotalDuration(workout, timingRecords, settings)` → `"~52 min"` |
| `exercises[$index]` | Iterates `workout.exercises`. Inside the row: `ex.name`, `ex.reps`. |
| `nextWorkout.label` | Rest-day-only: next `WorkoutDay.name + " — " + muscleGroups`. |

### Workout (`data-screen="workout"`)
| `data-bind` | Source |
|---|---|
| `session.elapsedClock` | `formatElapsed(useWorkoutDuration().elapsedSeconds)` — turn amber past `targetWorkoutMinutes`, red past `warningWorkoutMinutes`. |
| `session.progressToTargetPercent` | `(useWorkoutDuration().progressToTarget * 100).toFixed(0) + "%"` — bar width. |
| `settings.targetWorkoutMinutesFormatted` | `settings.targetWorkoutMinutes + "m"` |
| `exercise.name` | `activeWorkout.exercises[currentExerciseIndex].name` |
| `exercise.setProgressLabel` | `` `SET ${currentSetNumber} OF ${exercise.sets}  ·  ${exercise.reps}` `` (use `to failure` for AMRAP) |
| `exercise.breakLabel` | `` `BREAK  ·  SET ${currentSetNumber + 1} NEXT` `` |
| `timer.elapsedFormatted` | `formatTime(useTimer().elapsed)` |
| `timer.overtimeFormatted` | `"+" + formatTime(-useTimer().remaining)` when `isOvertime` |
| `timer.targetFormatted` | `formatTime(targetDuration)` |
| `timer.progressDashoffset` | Animated prop on the `<Circle>`: `CIRCUMFERENCE * (1 - progress.value)` (see §10). |

### Complete (`data-screen="complete"`)
| `data-bind` | Source |
|---|---|
| `session.totalDurationFormatted` | `formatHoursMinutes(totalDuration)` |
| `session.exercisesCompleted` | Count of distinct `exerciseId` in `setRecords`. |
| `session.totalSets` | `setRecords.length` |
| (rows) `row.name`, `row.setsLabel` | Per-exercise grouping of `setRecords`. |

### History (`data-screen="history"`)
| `data-bind` | Source |
|---|---|
| `history[$index]` | `historyStore.sessions` reverse-sorted by date. |
| `h.day` | Three-letter day badge derived from `session.day`. |
| `h.dateFormatted` | localized date from `session.date`. |
| `h.muscleGroups` | look up via `getWorkoutByDay(session.day).muscleGroups`. |
| `h.totalDurationFormatted` | `formatHoursMinutes(session.totalDuration)`. |
| `h.setsLabel` | `setRecords.length + " sets"`. |
| (expanded) `b.name`, `b.stat` | Per-exercise avg set + avg break computed from `session.setRecords`. |

### Settings (`data-screen="settings"`)
Each slider/segmented control declares `data-setting="<UserSettings key>"`. The four slider keys: `tier1SetDuration`, `tier1BreakDuration`, `standardSetDuration`, `standardBreakDuration`. The three segmented controls: `targetWorkoutMinutes`, `warningWorkoutMinutes`, `minSessionsForAdaptation`.

Slider ranges (from spec):
- T1 set: 30–90s, step 5
- T1 break: 90–240s, step 5
- Standard set: 20–60s, step 5
- Standard break: 60–150s, step 5

Wire each commit to `historyStore.updateSettings({ [key]: value })`.

---

## 9. Timer behaviour — exact rules

These are from `CLAUDE.md`. Honour them precisely.

### SET phase
- Count **up** from 0.
- At `targetDuration`: trigger alert (2s sound + 2s vibrate), then silent.
- Timer keeps running into overtime until user taps DONE.
- DONE writes `actualSetDuration = (Date.now() - phaseStartedAt) / 1000` and transitions to BREAK.

### BREAK phase
- Count **down** from `targetDuration`.
- At 0: trigger alert (2s sound + 2s vibrate), then silent.
- Timer continues into **overtime** — display flips to red and shows `+MM:SS`.
- START NEXT SET writes `actualBreakDuration` and starts the next set, OR advances to `/complete`.
- SKIP BREAK writes `actualBreakDuration = 0` and does the same transition.

### AMRAP
- No `setDuration` shown. Centre of ring shows `GO` until first tick (optional), then elapsed time.
- Ring spins (25%-fill arc) instead of progressing.
- Tap DONE when finished. Record `setDuration: null`.

### TIMED (Plank)
- Same as SET but counts up to a fixed 60s target. Same alert + overtime rules.

### CARDIO
- Never enters the timer flow. `complete-set` skip logic must advance over any `type: 'CARDIO'` exercise.

### Always-on
Use `useKeepAwake()` for the entire workout screen lifetime.

### 2-hour warning
`useWorkoutDuration` runs a `setInterval(1000)` and fires the overlay when `elapsedSeconds >= settings.warningWorkoutMinutes * 60 && !warningDismissed`. Overlay frame is design 07. Dismiss handler: `dismissWarning()`. Don't re-fire in the same session.

---

## 10. Animated ring — the only "fancy" bit

Use `react-native-svg` + `react-native-reanimated` + `useAnimatedProps`. Constants:

```ts
const RADIUS = 128;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 804.25
```

Phase → colour:

| Phase / state | Stroke |
|---|---|
| `set` | `#22D46E` |
| `break` (normal) | `#3B82F6` |
| `break` overtime | `#EF4444` |
| `amrap` | `#22D46E` with `rotate(progress * 360deg)` driving a fixed-arc dasharray. |
| `timed` | `#22D46E` |

Animate `progress` (0→1) with `withTiming` (or `withRepeat` for AMRAP). Wrap the SVG `<Circle>` with `Animated.createAnimatedComponent(Circle)` and feed `useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progress.value) }))`.

---

## 11. Learning algorithm

In `src/utils/timing.ts → getAdaptedTiming(exerciseId, exerciseType, allRecords, settings)`:

1. Filter `allRecords` for this `exerciseId`.
2. If `records.length < settings.minSessionsForAdaptation` → return `TimingDefaults` for that `exerciseType` (or the user-overridden duration from `settings`).
3. Otherwise take the **last 15** records and compute the average of `setDuration` and `breakDuration` (skip nulls for AMRAP set).
4. Clamp `breakDuration` to a minimum of 30s.
5. Return `{ setDuration: exerciseType === 'AMRAP' ? null : adaptedSet, breakDuration: Math.max(30, adaptedBreak) }`.

`estimateTotalDuration(workout, allRecords, settings)` sums per-exercise `(sets × setDuration + (sets - 1) × breakDuration)`, skipping CARDIO and using 45s as the AMRAP set estimate.

Settings changes do **not** retroactively affect the current session — read settings once when computing the next phase's `targetDuration`, not every tick.

---

## 12. Persistence (the only three AsyncStorage keys)

```
timing_history    TimingRecord[]
session_history   WorkoutSession[]
user_settings     UserSettings
```

Implementation: write through the store's `set` actions. After every mutation, `await AsyncStorage.setItem(KEY, JSON.stringify(value))`. On app start, `hydrate()` reads all three and seeds the store. Source pattern in `implementation-plan.html` §1.4.

**Never** clear or remove keys you didn't write. The reset button only clears `timing_history`.

---

## 13. Build / CI

`spec/app-spec.json → githubActions` is the spec. Steps:

1. Generate keystore locally (one-time): `keytool -genkeypair -storetype PKCS12 -keystore workout-timer.keystore -alias workouttimer -keyalg RSA -keysize 2048 -validity 10000`.
2. `base64 -i workout-timer.keystore | pbcopy` → paste into GitHub repo secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEY_ALIAS` (`workouttimer`)
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_STORE_PASSWORD`
3. Add `workout-timer.keystore` and `android/key.properties` to `.gitignore`.
4. Workflow at `.github/workflows/android.yml` — full YAML in `spec/implementation-plan.html` Phase 5. Steps: checkout → node-setup → java-17 → android-sdk → npm ci → `expo prebuild --platform android` → decode keystore → write `key.properties` → `cd android && ./gradlew assembleRelease` → upload artifact `workout-timer-release.apk`.
5. Triggered on push to `main`. Artifact downloadable from the Actions tab.

---

## 14. Phase order to build in

From `spec/implementation-plan.html`:

1. **Phase 1** — Types + data + stores + utils. Don't touch screens yet. Acceptance: `npx tsc --noEmit` clean.
2. **Phase 2** — Hooks (`useTimer`, `useWorkoutDuration`) + `CircularTimer` component. Acceptance: ring animates correctly under a manual `setPhase()` call in a sandbox screen.
3. **Phase 3** — Screens, in order: Home → Workout → Complete → History → Settings. For each, use `backend-wiring.md` to confirm every `data-action` is wired and every `data-bind` is populated.
4. **Phase 4** — Polish: keep-awake, haptics, sound, 2-hour warning overlay, AMRAP spinning arc, Plank TIMED variant.
5. **Phase 5** — CI: keystore, secrets, workflow YAML.

A screen is done when every tagged element in its matching frame in `Workout Timer.dc.html` has a working wire.

---

## 15. Acceptance — how to know you're done

For each screen, open `Workout Timer.dc.html`, look at the matching frame, and check:

- [ ] Every `data-action` has a wired `onPress`.
- [ ] Every `data-bind` shows the correct live value (try at least: empty history, mid-session, overtime).
- [ ] Every `data-state` / `data-phase` / `data-overlay` variant renders when its precondition is true.
- [ ] Every `data-setting` change persists across a hard kill of the app.
- [ ] Timer alerts fire exactly once at target, the screen stays awake, and overtime turns red.
- [ ] Skipping CARDIO works (Tuesday programme has no CARDIO; Friday's Pull-Ups are AMRAP, not CARDIO).
- [ ] `expo prebuild` + `gradle assembleRelease` produces a signed APK on push to `main`.

When all eight check for all five screens, the backend is attached. Ship it.
