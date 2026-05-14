# AGENTS.md

## Scope

- Single-package React Native Nitro Module library (not a monorepo).
- JS API source of truth: `src/specs/TempoClassifier.nitro.ts`; public exports: `src/index.ts`.
- Runtime path: TS spec -> generated Nitro bindings in `nitrogen/generated/**` -> C++ HybridObject in `cpp/HybridTempoClassifier.*` -> Rust FFI bridge in `cpp/rust/*` + `rust/src/lib.rs`.

## Commands

- Install: `npm install`
- Type check only: `npm run typecheck`
- Build TS output (`lib/`): `npm run typescript`
- Regenerate Nitro bindings (also runs TS emit): `npm run specs`
- Export tempo model from Python pickle: `python scripts/export_tempo_model.py --model ../ai/Rep\ Counting/tempo_classifier.pkl --config ../ai/Rep\ Counting/tempo_config.json --output tempo_classifier.json`
- Build Rust crate (all 4 Android ABIs): `cd rust && cargo build --release --target aarch64-linux-android && cargo build --release --target armv7-linux-androideabi && cargo build --release --target i686-linux-android && cargo build --release --target x86_64-linux-android`
- Refresh prebuilt binaries from Rust build: `cd android && cp ../rust/target/aarch64-linux-android/release/libtempo_classification_rust.a prebuilt/arm64-v8a/ && cp ../rust/target/armv7-linux-androideabi/release/libtempo_classification_rust.a prebuilt/armeabi-v7a/ && cp ../rust/target/i686-linux-android/release/libtempo_classification_rust.a prebuilt/x86/ && cp ../rust/target/x86_64-linux-android/release/libtempo_classification_rust.a prebuilt/x86_64/`
- Run example tests: `cd example && npm test`
- Full Android build (from example): `cd example && npm run android`

## Required workflows

- If any `*.nitro.ts` changes, run `npm run specs` before finishing.
- Commit `nitrogen/generated/**` changes produced by specs/codegen.
- Do not commit `lib/` (gitignored build output).
- There is no root `test` script; use lint/typecheck/specs plus targeted native/example runs for verification.
- When Rust source changes, rebuild prebuilt binaries and commit updated `.a` files.

## Prebuilt Rust binaries

- `android/prebuilt/<abi>/libtempo_classification_rust.a` — checked-in static lib for all 4 Android ABIs.
- `android/build-rust-android.sh` checks prebuilt freshness first; if fresh, skips Rust build.
- If `cargo` is unavailable and prebuilt exists, build succeeds using prebuilt.
- CMake (`android/CMakeLists.txt`) searches `prebuilt/` before `rust/target/`.
- `TEMPO_USE_RUST` define is set when the `.a` file is found by CMake; without it, C++ bridge compiles but returns fallback values ("unknown", 0.0).
- To update: build the Rust crate for all 4 targets, then copy `.a` files to `android/prebuilt/<abi>/`.

## Native gotchas

- Android build triggers `android/build-rust-android.sh` from `preBuild`; this prefers prebuilt binaries.
- `loadModelFromAsset(...)` is Android-only today (`HybridTempoClassifier.cpp` returns `false` on iOS).
- The module's `build.gradle` uses `implementation project(":react-native-nitro-modules")` — this is resolved by RN autolinking in the consuming app.

## Model export

The tempo model JSON must be placed in the example app's `android/app/src/main/assets/` directory for Android, or bundled via Xcode for iOS. The Python export script converts `tempo_classifier.pkl` to the format expected by `rf_model.rs`.

## Python TempoAnalyzer reference

The Rust state machine in `rust/src/lib.rs` mirrors `ai/Rep Counting/tempo.py`. Key logic:
- Tracks phase transitions (UP/DOWN/UNKNOWN)
- On rep completion, computes features: [total_s, half1_s, half2_s, half_ratio, exercise_enc]
- Runs RandomForest inference via `rf_model.rs`
