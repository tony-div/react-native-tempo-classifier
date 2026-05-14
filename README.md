# react-native-tempo-classifier

Real-time tempo classification (fast/normal/slow) from rep phase data, powered by a Rust RandomForest runtime.

## Installation

### npm (via GitHub Releases)

```sh
npm install https://github.com/tony-div/react-native-tempo-classifier/releases/download/v0.0.1/react-native-tempo-classifier-0.0.1.tgz
```

Or add to your `package.json`:

```json
"react-native-tempo-classifier": "https://github.com/tony-div/react-native-tempo-classifier/releases/download/v0.0.1/react-native-tempo-classifier-0.0.1.tgz"
```

Check the [latest release](https://github.com/tony-div/react-native-tempo-classifier/releases) for the current version.

### From source (development)

```sh
npm install
```

Requires `react-native-nitro-modules` as a peer dependency.

> **⚠️ Asset file required for `loadModelFromAsset()`**
>
> The tempo classifier model JSON (`tempo_classifier.json`) is **not** bundled with this npm package. You must export it from your trained `.pkl` file and place it **manually** in your app's Android assets directory:
> ```
> your-app/android/app/src/main/assets/tempo_classifier.json
> ```
>
> This file is **not** symlinked, copied, or included at install time. If it's missing, `loadModelFromAsset()` returns `false` silently. See [Model Export](#model-format) for the export command.

## API

### `tempoClassifier.loadModelFromJson(modelJson: string): boolean`

Load a model from a JSON string. The JSON must match the `rf_model.rs` format:

```ts
{
  "n_features": 5,
  "n_classes": 3,
  "classes": [0, 1, 2],
  "trees": [ /* ... */ ]
}
```

Returns `true` if the model was parsed successfully.

### `tempoClassifier.loadModelFromAsset(assetName: string): boolean`

Android-only. Loads a model JSON file from the app's bundled assets (e.g., `android/app/src/main/assets/tempo_classifier.json`). Pass the filename only — not a full path.

Returns `false` on iOS.

### `tempoClassifier.setExercise(exercise: string | null): void`

Set the current exercise name (e.g., `"bicep_curl"`). This is encoded as a feature in the classifier. Pass `null` or empty string to reset.

### `tempoClassifier.update(phase: string, fps?: number): void`

Feed a new phase value to the state machine.

- `phase`: `"UP"`, `"DOWN"`, or `"UNKNOWN"` (case-insensitive)
- `fps` (optional): frames per second for timing calculations (default: `30`)

The state machine tracks phase transitions and detects rep completion when a full UP→DOWN→UP cycle occurs.

### `tempoClassifier.getCurrentTempo(): string`

Returns the latest classified tempo label: `"fast"`, `"normal"`, `"slow"`, or `"unknown"` when insufficient data.

### `tempoClassifier.getCurrentQuality(): number`

Returns confidence percentage (0–100) for the latest tempo prediction. Returns `0` when `"unknown"`.

### `tempoClassifier.reset(): void`

Reset the internal state machine — clears phase history, rep tracking, and tempo prediction.

## Model Format

The classifier uses a scikit-learn RandomForest converted to JSON via `scripts/export_tempo_model.py`:

```sh
python scripts/export_tempo_model.py \
  --model ../ai/Rep\ Counting/tempo_classifier.pkl \
  --config ../ai/Rep\ Counting/tempo_config.json \
  --output tempo_classifier.json
```

Features (5): `[total_time_s, first_half_s, second_half_s, half_ratio, exercise_encoded]`

Classes: `["fast" (index 0), "normal" (index 1), "slow" (index 2)]`

## Architecture

```
TypeScript (src/index.ts)
  → Nitro Spec (src/specs/TempoClassifier.nitro.ts)
    → Nitrogen codegen (nitrogen/generated/)
      → HybridTempoClassifier (cpp/HybridTempoClassifier.cpp)
        → TempoClassifierRustBridge (cpp/rust/TempoClassifierRustBridge.cpp)
          → Rust FFI (rust/src/lib.rs)
            → RandomForestRunner (rust/src/rf_model.rs)
```

## Troubleshooting

### `TEMPO_USE_RUST` not defined / fallback values returned

The C++ bridge returns `"unknown"` / `0.0` when the Rust static library is not linked. This means the prebuilt `.a` file wasn't found at build time.

**Check:**
1. `android/prebuilt/<abi>/libtempo_classification_rust.a` exists for your target ABI
2. CMakeLists.txt line 30–36: the prebuilt path is correct
3. Rebuild: `cd example/android && ./gradlew clean :react-native-tempo-classifier:buildCMakeDebug[arm64-v8a]`

### `build-rust-android: cargo not found` warning

The build script logs this warning when `cargo` is unavailable. As long as prebuilt `.a` files exist, the build will still succeed. If the prebuilt files are stale or missing, the C++ bridge falls back to returning `"unknown"`.

**Fix:** Build the Rust crate on a machine with the Rust toolchain and Android targets installed, then copy the `.a` files:
```sh
cd rust
cargo build --release --target aarch64-linux-android
cargo build --release --target armv7-linux-androideabi
cargo build --release --target i686-linux-android
cargo build --release --target x86_64-linux-android
cp target/*/release/libtempo_classification_rust.a ../android/prebuilt/<abi>/
```

### Android native build fails during CMake configure

**Check:**
1. NDK version matches `gradle.properties` (`ndkVersion`). The example uses `27.1.12297006`.
2. C++20 toolchain is available (CMakeLists.txt sets `CMAKE_CXX_STANDARD 20`)
3. Prebuilt `.a` file is not corrupted (try rebuilding Rust and re-copying)

### `loadModelFromAsset()` returns `false` on iOS

This is expected — `loadModelFromAsset()` is Android-only. Use `loadModelFromJson()` instead on iOS.

### Test app shows "unknown" / 0% confidence

The inline fallback model in `App.tsx` passes an empty `trees: []` array, which always returns uniform probabilities. To get real predictions:

1. Export a trained model from your `.pkl` file
2. Place `tempo_classifier.json` in `example/android/app/src/main/assets/`
3. Call `tempoClassifier.loadModelFromAsset('tempo_classifier.json')` instead of `loadModelFromJson()`

### Rep completions not detected

The Rust state machine requires a full UP→DOWN→UP cycle. It rejects reps under 0.3 seconds or over 15 seconds. Ensure your phase updates alternate between `"UP"` and `"DOWN"` at realistic intervals.

## Files

| File | Purpose |
|------|---------|
| `src/specs/TempoClassifier.nitro.ts` | TypeScript Nitro spec — source of truth for native API |
| `nitrogen/generated/` | Auto-generated native boilerplate — do not edit |
| `rust/src/lib.rs` | Rust tempo state machine + FFI |
| `rust/src/rf_model.rs` | Generic RandomForest runner (reused) |
| `cpp/HybridTempoClassifier.cpp` | C++ HybridObject — delegates to Rust bridge |
| `cpp/rust/TempoClassifierRustBridge.cpp` | C++ FFI bridge, guarded by `TEMPO_USE_RUST` |
| `android/prebuilt/` | Prebuilt Rust staticlibs for all 4 Android ABIs |
| `android/build-rust-android.sh` | Build script — prefers prebuilt, falls back to `cargo` |
| `scripts/export_tempo_model.py` | Converts `.pkl` → JSON for Rust runtime |
| `example/App.tsx` | Demo app with live HUD and phase simulation |

## License

MIT
