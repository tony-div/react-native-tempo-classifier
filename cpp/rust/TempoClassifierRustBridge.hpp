#pragma once

#include <string>

namespace margelo::nitro::tempoclassifier {

class TempoClassifierRustBridge {
 public:
  bool loadModelFromJson(const std::string& modelJson);
  void setExercise(const std::string& exercise);
  void update(const std::string& phase, double fps);
  std::string getCurrentTempo();
  double getCurrentQuality();
  void reset();
};

} // namespace margelo::nitro::tempoclassifier
