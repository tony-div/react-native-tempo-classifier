#include "TempoClassifierRustBridge.hpp"

#include <cstddef>
#include <cstdio>

#if defined(__ANDROID__)
#include <android/log.h>
#endif

#if defined(TEMPO_USE_RUST)
extern "C" {
int tempo_load_model(const char* model_json);
void tempo_set_exercise(const char* exercise);
void tempo_update(const char* phase, double fps);
char* tempo_get_tempo();
double tempo_get_quality();
void tempo_reset();
void tempo_string_free(char* s);
}
#endif

namespace margelo::nitro::tempoclassifier {

namespace {

constexpr const char* kLogTag = "NitroTempoCls";

void logDebug(const char* message) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, "%s", message);
#else
  std::fprintf(stderr, "[%s] %s\n", kLogTag, message);
#endif
}

void logDebugFmt(const char* format, const std::string& value) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, format, value.c_str());
#else
  std::fprintf(stderr, "[%s] ", kLogTag);
  std::fprintf(stderr, format, value.c_str());
  std::fprintf(stderr, "\n");
#endif
}

} // namespace

bool TempoClassifierRustBridge::loadModelFromJson(const std::string& modelJson) {
#if defined(TEMPO_USE_RUST)
  logDebugFmt("rust.loadModelFromJson(): input bytes=%d", std::to_string(static_cast<int>(modelJson.size())));
  const bool loaded = tempo_load_model(modelJson.c_str()) == 1;
  logDebugFmt("rust.loadModelFromJson(): result=%d", loaded ? "1" : "0");
  return loaded;
#else
  (void)modelJson;
  logDebug("rust.loadModelFromJson(): TEMPO_USE_RUST disabled, returning false");
  return false;
#endif
}

void TempoClassifierRustBridge::setExercise(const std::string& exercise) {
#if defined(TEMPO_USE_RUST)
  logDebugFmt("rust.setExercise(): '%s'", exercise);
  tempo_set_exercise(exercise.c_str());
#else
  (void)exercise;
  logDebug("rust.setExercise(): TEMPO_USE_RUST disabled");
#endif
}

void TempoClassifierRustBridge::update(const std::string& phase, double fps) {
#if defined(TEMPO_USE_RUST)
  logDebugFmt("rust.update(): phase='%s'", phase);
  tempo_update(phase.c_str(), fps);
#else
  (void)phase;
  (void)fps;
  logDebug("rust.update(): TEMPO_USE_RUST disabled");
#endif
}

std::string TempoClassifierRustBridge::getCurrentTempo() {
#if defined(TEMPO_USE_RUST)
  char* raw = tempo_get_tempo();
  if (raw == nullptr) {
    logDebug("rust.getCurrentTempo(): returned null");
    return "unknown";
  }
  std::string out(raw);
  tempo_string_free(raw);
  logDebugFmt("rust.getCurrentTempo(): '%s'", out);
  return out;
#else
  logDebug("rust.getCurrentTempo(): TEMPO_USE_RUST disabled, returning unknown");
  return "unknown";
#endif
}

double TempoClassifierRustBridge::getCurrentQuality() {
#if defined(TEMPO_USE_RUST)
  const double quality = tempo_get_quality();
  return quality;
#else
  logDebug("rust.getCurrentQuality(): TEMPO_USE_RUST disabled, returning 0");
  return 0.0;
#endif
}

void TempoClassifierRustBridge::reset() {
#if defined(TEMPO_USE_RUST)
  logDebug("rust.reset(): begin");
  tempo_reset();
  logDebug("rust.reset(): complete");
#else
  logDebug("rust.reset(): TEMPO_USE_RUST disabled");
#endif
}

} // namespace margelo::nitro::tempoclassifier
