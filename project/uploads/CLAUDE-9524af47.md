# Workout Timer — Project Context

## What this is
A personal Android workout timer app for Brian's 4-day lifting programme.
Expo (React Native) + TypeScript. No backend. No auth. All data local.

## Stack
- Expo SDK 53 (managed workflow + prebuild for CI)
- Expo Router 4 (file-based nav)
- React Native Reanimated 3 (circular timer animation)
- react-native-svg (SVG ring)
- Zustand (state management)
- @react-native-async-storage/async-storage (local persistence)
- expo-keep-awake (screen always-on during workout)
- expo-haptics (vibration alerts)
- expo-av (sound alerts)
- TypeScript strict mode

## Build target
Android APK only. Built via GitHub Actions using `expo prebuild` + Gradle.
APK uploaded as artifact — downloadable from Actions tab. No EAS cloud.

## Design system
- Dark-first, OLED-optimized (true blacks)
- 4-surface dark palette: bg #0A0A0A → surface1 #111111 → surface2 #1C1C1C → surface3 #262626
- Accent green: #22D46E (active set / done)
- Accent blue: #3B82F6 (break / rest)
- Accent amber: #F59E0B (T1 / heavy lifts badge)
- Red: #EF4444 (overtime / 2hr warning)
- Text primary: #F0F0F0, secondary: #888888
- Border/divider: #2A2A2A
- Font: System font (SF Pro on iOS / Roboto on Android)
- Circular ring timer is the centrepiece of the workout screen

## Workout programme (hardcoded)
Monday: Chest/Biceps/Abs (T1: Flat Barbell Bench Press)
Tuesday: Legs (T1: Barbell Back Squats)
Wednesday: REST
Thursday: Shoulders/Triceps/Abs (T1: Standing Military Press)
Friday: Back/Rear Delts (T1: Deadlifts)
Saturday/Sunday: REST

## Exercise types
- TIER1: Heavy compound. setDuration=60s, breakDuration=150s (2:30)
- STANDARD: Accessory work. setDuration=40s, breakDuration=90s (1:30)
- AMRAP: To failure (Ab Roller, Dips, Pull-Ups). No set duration, user taps Done. breakDuration=90s
- TIMED: Fixed duration (Plank 60s). setDuration=60s, breakDuration=60s
- CARDIO: Skip from timer (Rowing finishers). Not tracked.

## Timer behaviour
SET phase: Counts UP. Alert at target (sound 2s + vibrate 2s then silent). Timer keeps running until user taps DONE.
BREAK phase: Counts DOWN. Alert at 0 (sound 2s + vibrate 2s then silent). Timer continues into overtime (shows +MM:SS in red). User taps START NEXT SET.
Screen always-on via expo-keep-awake.

## Learning system
After each session, record actual set/break durations per exercise.
Once ≥3 sessions exist for an exercise, use rolling average (last 15 records) as default time.
Stored in AsyncStorage under key `timing_history`.

## Workout duration tracking
Target: 90 minutes. Warn at 120 minutes (full-screen dismissible alert).
Show elapsed clock always visible in workout header.

## File structure
src/data/workouts.ts        — hardcoded programme
src/store/workoutStore.ts   — active session state (Zustand)
src/store/historyStore.ts   — session history (Zustand + AsyncStorage)
src/utils/timing.ts         — defaults, T1 detection, learning algo
src/components/             — reusable UI components
app/                        — Expo Router screens

## Key rules
- Never import from app/ inside src/ (one-way dependency)
- All times in seconds internally, display as MM:SS
- AMRAP sets: skip set timer, show open stopwatch, wait for Done tap
- Cardio finishers: never appear in timer flow at all
- Keep screen always-on for entire workout session
- Settings changes do NOT retroactively affect the current session
