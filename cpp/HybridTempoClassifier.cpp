#include "HybridTempoClassifier.hpp"

#include <cstdio>

#if defined(__ANDROID__)
#include <android/log.h>
#include <fbjni/fbjni.h>
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

void logDebugFmt(const char* format, const std::string& value) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, format, value.c_str());
#else
  std::fprintf(stderr, "[%s] ", kLogTag);
  std::fprintf(stderr, format, value.c_str());
  std::fprintf(stderr, "\n");
#endif
}

void logDebugFmt(const char* format, double value) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, format, value);
#else
  std::fprintf(stderr, "[%s] ", kLogTag);
  std::fprintf(stderr, format, value);
  std::fprintf(stderr, "\n");
#endif
}

void logDebugFmt(const char* format, int value) {
#if defined(__ANDROID__)
  __android_log_print(ANDROID_LOG_DEBUG, kLogTag, format, value);
#else
  std::fprintf(stderr, "[%s] ", kLogTag);
  std::fprintf(stderr, format, value);
  std::fprintf(stderr, "\n");
#endif
}

#if defined(__ANDROID__)
std::string loadAndroidAssetText(const std::string& assetName) {
  logDebugFmt("loadAndroidAssetText(): requested asset='%s'", assetName);
  auto env = facebook::jni::Environment::current();
  if (env == nullptr) {
    logDebug("loadAndroidAssetText(): JNI environment is null");
    return "";
  }

  jclass cls = env->FindClass("com/margelo/nitro/tempoclassifier/TempoClassifierAssets");
  if (cls == nullptr) {
    logDebug("loadAndroidAssetText(): TempoClassifierAssets class not found");
    return "";
  }

  jmethodID method = env->GetStaticMethodID(
    cls,
    "loadAssetAsString",
    "(Ljava/lang/String;)Ljava/lang/String;");
  if (method == nullptr) {
    logDebug("loadAndroidAssetText(): loadAssetAsString method not found");
    env->DeleteLocalRef(cls);
    return "";
  }

  jstring jAssetName = env->NewStringUTF(assetName.c_str());
  jobject jResult = env->CallStaticObjectMethod(cls, method, jAssetName);
  env->DeleteLocalRef(jAssetName);
  env->DeleteLocalRef(cls);

  if (jResult == nullptr) {
    logDebug("loadAndroidAssetText(): Java returned null asset content");
    return "";
  }

  auto* resultStr = static_cast<jstring>(jResult);
  const char* utfChars = env->GetStringUTFChars(resultStr, nullptr);
  if (utfChars == nullptr) {
    logDebug("loadAndroidAssetText(): failed to access UTF chars");
    env->DeleteLocalRef(resultStr);
    return "";
  }

  std::string output(utfChars);
  env->ReleaseStringUTFChars(resultStr, utfChars);
  env->DeleteLocalRef(resultStr);
  logDebugFmt("loadAndroidAssetText(): loaded bytes=%d", static_cast<int>(output.size()));
  return output;
}
#endif

} // namespace

namespace margelo::nitro::tempoclassifier {

bool HybridTempoClassifier::loadModelFromJson(const std::string& modelJson) {
  logDebugFmt("loadModelFromJson(): input bytes=%d", static_cast<int>(modelJson.size()));
  const bool loaded = rust_.loadModelFromJson(modelJson);
  logDebugFmt("loadModelFromJson(): result=%d", loaded ? 1 : 0);
  return loaded;
}

bool HybridTempoClassifier::loadModelFromAsset(const std::string& assetName) {
  logDebugFmt("loadModelFromAsset(): asset='%s'", assetName);
#if defined(__ANDROID__)
  const auto modelJson = loadAndroidAssetText(assetName);
  if (modelJson.empty()) {
    logDebug("loadModelFromAsset(): asset load returned empty content");
    return false;
  }
  const bool loaded = rust_.loadModelFromJson(modelJson);
  logDebugFmt("loadModelFromAsset(): rust load result=%d", loaded ? 1 : 0);
  return loaded;
#else
  (void)assetName;
  logDebug("loadModelFromAsset(): unsupported on this platform");
  return false;
#endif
}

void HybridTempoClassifier::setExercise(const std::optional<std::variant<nitro::NullType, std::string>>& exercise) {
  if (exercise.has_value()) {
    const auto& value = exercise.value();
    if (std::holds_alternative<std::string>(value)) {
      const auto& ex = std::get<std::string>(value);
      logDebugFmt("setExercise(): '%s'", ex);
      rust_.setExercise(ex);
      return;
    }
  }
  logDebug("setExercise(): null");
  rust_.setExercise("");
}

void HybridTempoClassifier::update(const std::string& phase, std::optional<double> fps) {
  const double fpsVal = fps.value_or(30.0);
  logDebugFmt("update(): phase='%s'", phase);
  rust_.update(phase, fpsVal);
}

std::string HybridTempoClassifier::getCurrentTempo() {
  const auto tempo = rust_.getCurrentTempo();
  logDebugFmt("getCurrentTempo(): '%s'", tempo);
  return tempo;
}

double HybridTempoClassifier::getCurrentQuality() {
  const auto quality = rust_.getCurrentQuality();
  logDebugFmt("getCurrentQuality(): %.0f", quality);
  return quality;
}

void HybridTempoClassifier::reset() {
  logDebug("reset(): begin");
  rust_.reset();
  logDebug("reset(): complete");
}

} // namespace margelo::nitro::tempoclassifier
