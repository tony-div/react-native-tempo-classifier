#include "HybridTempoClassifier.hpp"

#include <cstdio>

#if defined(__ANDROID__)
#include <android/log.h>
#endif

namespace {

constexpr const char* kLogTag = "NitroTempoCls";

void logDebug(const char* message) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, "%s", message);
#else
  std::fprintf(stderr, "[%s] %s\n", kLogTag, message);
#endif
}

} // namespace

namespace margelo::nitro::tempoclassifier {

bool HybridTempoClassifier::loadModelFromJson(const std::string& /*modelJson*/) {
  logDebug("loadModelFromJson(): iOS fallback - not supported");
  return false;
}

bool HybridTempoClassifier::loadModelFromAsset(const std::string& /*assetName*/) {
  logDebug("loadModelFromAsset(): iOS fallback - not supported");
  return false;
}

void HybridTempoClassifier::setExercise(const std::optional<std::variant<nitro::NullType, std::string>>& /*exercise*/) {
  logDebug("setExercise(): iOS fallback");
}

void HybridTempoClassifier::update(const std::string& /*phase*/, std::optional<double> /*fps*/) {
  logDebug("update(): iOS fallback");
}

std::string HybridTempoClassifier::getCurrentTempo() {
  logDebug("getCurrentTempo(): iOS fallback");
  return "unknown";
}

double HybridTempoClassifier::getCurrentQuality() {
  logDebug("getCurrentQuality(): iOS fallback");
  return 0.0;
}

void HybridTempoClassifier::reset() {
  logDebug("reset(): iOS fallback");
}

} // namespace margelo::nitro::tempoclassifier
