# AGENTS.md

## Scope

- Single-package React Native Nitro Module library (not a monorepo).
- JS API source of truth: `src/specs/TempoClassifier.nitro.ts`; public exports: `src/index.ts`.
- Runtime path: TS spec -> generated Nitro bindings in `nitrogen/generated/**` -> C++ HybridObject in `cpp/HybridTempoClassifier.*` -> JNI bridge in `cpp/rust/*` -> Kotlin engine in `android/.../TempoClassifierEngine.kt` -> `react-native-random-forest` RF inference.
- **NO Rust code in this package.** All Rust lives in `react-native-random-forest`.

## Commands

- Install: `npm install`
- Type check only: `npm run typecheck`
- Build TS output (`lib/`): `npm run typescript`
- Regenerate Nitro bindings (also runs TS emit): `npm run specs`
- Export tempo model from Python pickle: `python scripts/export_tempo_model.py --model ../ai/Rep\ Counting/tempo_classifier.pkl --config ../ai/Rep\ Counting/tempo_config.json --output tempo_classifier.json`
- Run example tests: `cd example && npm test`
- Full Android build (from example): `cd example && npm run android`

## Required workflows

- If any `*.nitro.ts` changes, run `npm run specs` before finishing.
- Commit `nitrogen/generated/**` changes produced by specs/codegen.
- Do not commit `lib/` (gitignored build output).
- There is no root `test` script; use lint/typecheck/specs plus targeted native/example runs for verification.

## Native gotchas

- `loadModelFromAsset(...)` is Android-only today (`HybridTempoClassifier.cpp` returns `false` on iOS).
- The module's `build.gradle` uses `implementation project(":react-native-nitro-modules")` and `implementation project(":react-native-random-forest")` — these are resolved by RN autolinking in the consuming app.
- Android build requires `react-native-random-forest` as a project dependency.
- The RF inference engine lives in `react-native-random-forest`. TempoClassifierEngine calls `RandomForestBridge` (JNI) for model loading and predictions.

## Model export

The tempo model JSON must be placed in the example app's `android/app/src/main/assets/` directory for Android, or bundled via Xcode for iOS. The Python export script converts `tempo_classifier.pkl` to the format expected by `rf_model.rs` (from `react-native-random-forest`).

## Kotlin TempoClassifierEngine reference

The Kotlin state machine in `TempoClassifierEngine.kt` mirrors `ai/Rep Counting/tempo.py`. Key logic:
- Tracks phase transitions (UP/DOWN/UNKNOWN)
- On rep completion, computes features: [total_s, half1_s, half2_s, half_ratio, exercise_enc]
- Runs RandomForest inference via `react-native-random-forest`'s `RandomForestBridge`
