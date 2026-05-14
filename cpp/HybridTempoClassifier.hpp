#pragma once

#include "../nitrogen/generated/shared/c++/HybridTempoClassifierSpec.hpp"
#include "rust/TempoClassifierRustBridge.hpp"

#include <optional>
#include <string>
#include <variant>

namespace margelo::nitro::tempoclassifier {

class HybridTempoClassifier : public HybridTempoClassifierSpec {
 public:
  HybridTempoClassifier() : HybridObject(TAG) {}

 public:
  bool loadModelFromJson(const std::string& modelJson) override;
  bool loadModelFromAsset(const std::string& assetName) override;
  void setExercise(const std::optional<std::variant<nitro::NullType, std::string>>& exercise) override;
  void update(const std::string& phase, std::optional<double> fps) override;
  std::string getCurrentTempo() override;
  double getCurrentQuality() override;
  void reset() override;

 private:
  TempoClassifierRustBridge rust_;
};

} // namespace margelo::nitro::tempoclassifier
