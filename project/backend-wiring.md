# Workout Timer — Backend Wiring Map

Every tappable element, screen, and dynamic value in `Workout Timer.dc.html` is tagged with `data-*` attributes so handlers and bindings can be attached deterministically. This file is the cross-reference.

## Attribute conventions

| Attribute | Meaning |
|---|---|
| `data-screen` | Logical screen name. Matches an Expo Router file under `app/`. |
| `data-route` | Expo Router path (`/`, `/workout`, `/history`, `/settings`, `/complete`). |
| `data-state` | A variant of the same screen (`has_workout`, `rest_day`, `overtime`, `selected`, `current`, `completed`, `remaining`). |
| `data-phase` | Timer phase on the Workout screen (`set`, `break`, `amrap`, `timed`). |
| `data-overlay` | A modal overlay name (`two-hour-warning`). |
| `data-action` | Handler to wire — store action name or navigation intent. |
| `data-feature` | Major UI feature this element belongs to (used for styling and analytics, not handlers). |
| `data-bind` | Path of the dynamic value to render. Resolved against the active workout / session / settings / timer state. |
| `data-setting` | Which key of `UserSettings` a control writes to. |
| `data-value` | The literal value a segmented-control segment commits when tapped. |

---

## Screens

| `data-screen` | `data-route` | File | States |
|---|---|---|---|
| `home` | `/` | `app/index.tsx` | `has_workout`, `rest_day` |
| `workout` | `/workout` | `app/workout/index.tsx` | phases: `set`, `break`, `amrap`, `timed`; overlay: `two-hour-warning` |
| `complete` | `/complete` | `app/complete.tsx` | — |
| `history` | `/history` | `app/history.tsx` | — |
| `settings` | `/settings` | `app/settings.tsx` | — |

---

## Actions (every `data-action`)

| `data-action` | Where | Store call / navigation |
|---|---|---|
| `navigate-history` | Home header icon | `router.push('/history')` |
| `navigate-settings` | Home header icon | `router.push('/settings')` |
| `navigate-home` | Complete screen DONE | `router.replace('/')` |
| `go-back` | History / Settings header | `router.back()` |
| `start-workout` | Home bottom CTA | create `sessionId`, `workoutStore.startWorkout(todayWorkout, sessionId)`, `startSet(timing.setDuration)`, `router.push('/workout')` |
| `complete-set` | DONE button (SET / AMRAP / TIMED) | `stopAlert()`, compute `actualSetDuration`, `addSetRecord(...)`, `addTimingRecord(...)`, `startBreak(timing.breakDuration)` |
| `start-next-set` | BREAK primary button | `stopAlert()`, compute `actualBreakDuration`, update last timing record's `breakDuration`, `completeBreak(actualBreakDuration)`, then `startSet(nextTiming.setDuration)` or `router.replace('/complete')` |
| `skip-break` | BREAK secondary button | `workoutStore.skipBreak()` (records `actualBreakDuration: 0`, then transitions same as above) |
| `abandon-workout` | Workout header ✕ | confirmation `Alert`, then `workoutStore.abandonWorkout()`, `router.replace('/')` |
| `dismiss-warning` | 2‑hour warning overlay button | `workoutStore.dismissWarning()` |
| `toggle-session-expanded` | History row & "Collapse ↑" | local component state: toggle `expandedSessionId` (LayoutAnimation) |
| `navigate-exercise-detail` | Home exercise rows | optional — no detail screen specced; can be a no-op or future route |
| `update-setting` | Slider rows & segmented control segments | `historyStore.updateSettings({ [data-setting]: Number(data-value or sliderValue) })` |
| `reset-learning` | Settings destructive row | confirmation `Alert`, then `historyStore.resetLearning()` |

---

## Bindings (every `data-bind`)

### Home (`data-screen="home"`)
| Binding | Source |
|---|---|
| `workout.day.name` | `getTodayWorkout().name` (uppercase) |
| `workout.muscleGroups` | `getTodayWorkout().muscleGroups` |
| `workout.exerciseCount` | `workout.exercises.length` |
| `workout.estimatedDurationFormatted` | `estimateTotalDuration(workout, timingRecords, settings)` + `" min"` prefix `~` |
| `exercises[$index]` | `workout.exercises[i]` — the row element receives the exercise object |
| `ex.name`, `ex.reps` | `Exercise.name`, `Exercise.reps` |
| `nextWorkout.label` | Rest day only — next upcoming `WorkoutDay.name + " — " + muscleGroups` |

### Workout (`data-screen="workout"`)
| Binding | Source |
|---|---|
| `session.elapsedClock` | `formatElapsed(useWorkoutDuration().elapsedSeconds)` — turns amber > 90m, red > 120m |
| `session.progressToTargetPercent` | `useWorkoutDuration().progressToTarget * 100 + "%"` — bar width |
| `settings.targetWorkoutMinutesFormatted` | `settings.targetWorkoutMinutes + "m"` |
| `exercise.name` | `activeWorkout.exercises[currentExerciseIndex].name` |
| `exercise.setProgressLabel` | `\`SET ${currentSetNumber} OF ${exercise.sets}  ·  ${exercise.reps}\`` |
| `exercise.breakLabel` | `\`BREAK  ·  SET ${currentSetNumber + 1} NEXT\`` |
| `timer.elapsedFormatted` | `formatTime(useTimer().elapsed)` |
| `timer.overtimeFormatted` | `"+" + formatTime(-useTimer().remaining)` (when `isOvertime`) |
| `timer.targetFormatted` | `formatTime(targetDuration)` |
| `timer.progressDashoffset` | `useAnimatedProps`: `CIRCUMFERENCE * (1 - progress.value)` — animated prop on the ring `<circle>` |

### Complete (`data-screen="complete"`)
| Binding | Source |
|---|---|
| `session.totalDurationFormatted` | `formatHoursMinutes(setRecords totalTime)` — e.g. `"1h 04m"` |
| `session.exercisesCompleted` | distinct `exerciseId` count in `setRecords` |
| `session.totalSets` | `setRecords.length` |
| `row.name`, `row.setsLabel` | per-exercise grouping of `setRecords` |

### History (`data-screen="history"`)
| Binding | Source |
|---|---|
| `history[$index]` | `historyStore.sessions[i]` |
| `h.day` | three-letter day badge from `session.day` |
| `h.dateFormatted` | localized date from `session.date` |
| `h.muscleGroups` | the day's `muscleGroups` (look up via `getWorkoutByDay(session.day)`) |
| `h.totalDurationFormatted` | `formatHoursMinutes(session.totalDuration)` |
| `h.setsLabel` | `setRecords.length + " sets"` |
| `b.name`, `b.stat` | per-exercise avg set + avg break from `session.setRecords` |

### Settings (`data-screen="settings"`)
Each slider / segmented control declares `data-setting="<UserSettings key>"`. Wire its commit to `historyStore.updateSettings({ [key]: value })`. The four `UserSettings` slider keys present: `tier1SetDuration`, `tier1BreakDuration`, `standardSetDuration`, `standardBreakDuration`. The segmented controls: `targetWorkoutMinutes`, `warningWorkoutMinutes`, `minSessionsForAdaptation`.

For sliders: bind `s.valueFormatted` to a formatted current value, `s.pct` to the slider position as a CSS percentage. The display values follow the spec ranges (T1 set 30–90s step 5, T1 break 90–240s step 5, Standard set 20–60s step 5, Standard break 60–150s step 5).

---

## Feature tags (no handler, but useful)

`data-feature` values currently used:

`workout-stats-card`, `exercise-list`, `t1-badge`, `amrap-badge`, `primary-cta`, `secondary-cta`, `elapsed-clock`, `workout-progress-bar`, `circular-timer`, `set-dots-indicator`, `success-checkmark`, `session-stats-card`, `session-breakdown`, `session-list`, `session-detail`, `day-badge`, `slider-setting`, `slider-track`, `slider-thumb`, `segmented-setting`, `segmented-control`, `destructive-action`, `two-hour-warning-overlay`, `warning-card`, `rest-day-block`.

Use these for analytics events (e.g. `track('tap', el.dataset.feature)`) or for component-level styling overrides.

---

## Phase / state matrix (Workout screen)

| `data-phase` | Ring colour | Centre text | Sub-label | Primary CTA |
|---|---|---|---|---|
| `set` | `green` | `timer.elapsedFormatted` (counts up) | `Elapsed` | DONE (green) |
| `break` | `blue` | `formatTime(remaining)` (counts down) | `Remaining` | START NEXT SET (blue) + SKIP BREAK |
| `break` + `data-state="overtime"` | `red` | `timer.overtimeFormatted` (e.g. `+0:45`) | `Overtime` | START NEXT SET + SKIP BREAK |
| `amrap` | `green` (spinning 25% arc) | `GO`, then `timer.elapsedFormatted` once started | `to failure` | DONE (green) |
| `timed` | `green` | `timer.elapsedFormatted` (counts up to 60s) | `Elapsed` | DONE (green) |

---

## Quick selectors

```ts
// All tappable elements
document.querySelectorAll('[data-action]')

// All bound values on the active screen
document.querySelectorAll('[data-screen="workout"] [data-bind]')

// Every setting control
document.querySelectorAll('[data-setting]')
```

In React Native this maps 1:1 to a small helper in the screen file:

```tsx
const onAction = (action: string) => {
  switch (action) {
    case 'start-workout':  return startWorkout();
    case 'complete-set':   return completeSet();
    case 'start-next-set': return startNextSet();
    case 'skip-break':     return skipBreak();
    case 'abandon-workout':return abandonWorkout();
    case 'dismiss-warning':return dismissWarning();
    case 'navigate-history':  return router.push('/history');
    case 'navigate-settings': return router.push('/settings');
    case 'navigate-home':     return router.replace('/');
    case 'go-back':           return router.back();
    case 'reset-learning':    return confirmAndReset();
  }
};
```
