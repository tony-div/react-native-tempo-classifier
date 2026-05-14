import React from 'react'
import renderer from 'react-test-renderer'

jest.mock(
  'react-native-pose-landmarks',
  () => ({
    PoseLandmarksView: 'PoseLandmarksView',
  }),
  { virtual: true }
)

jest.mock(
  'react-native-exercise-recognition',
  () => ({
    exerciseRecognition: {
      loadModelFromAsset: () => true,
      startSession: () => undefined,
      stopSession: () => undefined,
      ingestLandmarksBuffer: () => undefined,
      getCurrentExercise: () => 'push_up',
      getCurrentConfidence: () => 0.92,
      getLastClassifierInferenceTimeMs: () => 0.5,
    },
  }),
  { virtual: true }
)

jest.mock(
  'react-native-rep-counter',
  () => ({
    createRepCounter: () => ({
      startSession: () => undefined,
      stopSession: () => undefined,
      setExercise: () => undefined,
      resetReps: () => undefined,
      resetAll: () => undefined,
      getState: () => ({
        exercise: 'push_up',
        reps: 5,
        confidence: 0.88,
        phase: 'UP',
        activeArm: 'right',
      }),
      update: () => ({
        exercise: 'push_up',
        reps: 5,
        confidence: 0.88,
        phase: 'UP',
        activeArm: 'right',
      }),
    }),
  }),
  { virtual: true }
)

jest.mock(
  'react-native-nitro-modules',
  () => ({
    callback: (fn: any) => fn,
  }),
  { virtual: true }
)

jest.mock(
  'react-native-tempo-classifier',
  () => ({
    tempoClassifier: {
      loadModelFromJson: () => true,
      loadModelFromAsset: () => true,
      setExercise: () => undefined,
      update: () => undefined,
      getCurrentTempo: () => 'normal',
      getCurrentQuality: () => 85,
      reset: () => undefined,
    },
  }),
  { virtual: true }
)

import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    renderer.create(<App />)
  })
})
