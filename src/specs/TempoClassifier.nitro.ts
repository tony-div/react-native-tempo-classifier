import { type HybridObject, NitroModules } from 'react-native-nitro-modules'

export interface TempoClassifier extends HybridObject<{
  ios: 'c++'
  android: 'kotlin'
}> {
  loadModelFromJson(modelJson: string): boolean
  loadModelFromAsset(assetName: string): boolean
  setExercise(exercise: string | null): void
  update(phase: string, fps?: number): void
  getCurrentTempo(): string
  getCurrentQuality(): number
  reset(): void
}

export const tempoClassifier =
  NitroModules.createHybridObject<TempoClassifier>('TempoClassifier')
