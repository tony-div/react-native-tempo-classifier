#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUST_DIR="$ROOT_DIR/rust"
PREBUILT_DIR="$ROOT_DIR/android/prebuilt"

ABI_MAP=(
  "aarch64-linux-android:arm64-v8a"
  "armv7-linux-androideabi:armeabi-v7a"
  "i686-linux-android:x86"
  "x86_64-linux-android:x86_64"
)

check_stale() {
  for pair in "${ABI_MAP[@]}"; do
    abi="${pair##*:}"
    prebuilt="$PREBUILT_DIR/$abi/libtempo_classification_rust.a"
    if [ -f "$prebuilt" ]; then
      if [ "$prebuilt" -nt "$RUST_DIR/Cargo.toml" ] && [ "$prebuilt" -nt "$RUST_DIR/src/lib.rs" ]; then
        continue
      fi
    fi
    return 0
  done
  return 1
}

if ! check_stale; then
  echo "build-rust-android: Using prebuilt binaries"
  exit 0
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "build-rust-android: cargo not found, using prebuilt (may be stale)"
  exit 0
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "build-rust-android: rustup not found, using prebuilt (may be stale)"
  exit 0
fi

for pair in "${ABI_MAP[@]}"; do
  target="${pair%%:*}"
  abi="${pair##*:}"
  rustup target add "$target" >/dev/null 2>&1 || true
  cargo build --manifest-path "$RUST_DIR/Cargo.toml" --target "$target" --release
  mkdir -p "$PREBUILT_DIR/$abi"
  cp "$RUST_DIR/target/$target/release/libtempo_classification_rust.a" "$PREBUILT_DIR/$abi/"
done
