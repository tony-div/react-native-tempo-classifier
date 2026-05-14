import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Dimensions, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { callback } from 'react-native-nitro-modules'
import { PoseLandmarksView } from 'react-native-pose-landmarks'
import { exerciseRecognition } from 'react-native-exercise-recognition'
import { createRepCounter } from 'react-native-rep-counter'
import { tempoClassifier } from 'react-native-tempo-classifier'

const LANDMARK_COUNT = 33
const VALUES_PER_LANDMARK = 4
const DEFAULT_SIZE = Dimensions.get('window')

function App(): React.JSX.Element {
  const [sessionActive, setSessionActive] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [landmarksCount, setLandmarksCount] = useState(0)

  const [currentExercise, setCurrentExercise] = useState<string | null>(null)
  const [exerciseConfidence, setExerciseConfidence] = useState(0)

  const [phase, setPhase] = useState('UNKNOWN')
  const [reps, setReps] = useState(0)
  const [repConfidence, setRepConfidence] = useState(0)
  const [activeArm, setActiveArm] = useState<string | null>(null)

  const [tempo, setTempo] = useState('unknown')
  const [quality, setQuality] = useState(0)

  const [inferenceMs, setInferenceMs] = useState(-1)
  const [classifierInferenceMs, setClassifierInferenceMs] = useState(-1)

  const poseLandmarksRef = useRef<any>(null)
  const repCounterRef = useRef<any>(null)
  const hasLoadedModel = useRef(false)
  const tempoRepCountRef = useRef(0)

  useEffect(() => {
    if (!sessionActive) return
    console.log('[Pipeline] session active, initializing pipeline')

    if (!hasLoadedModel.current) {
      const loaded = exerciseRecognition.loadModelFromAsset('exercise_classifier_rf.json')
      hasLoadedModel.current = loaded
      setModelLoaded(loaded)
      console.log('[Pipeline] loadModel:', loaded)
      if (!loaded) return

      const tempoLoaded = tempoClassifier.loadModelFromAsset('tempo_classifier.json')
      console.log('[Pipeline] tempo loadModel:', tempoLoaded)
    }

    repCounterRef.current = createRepCounter()
    repCounterRef.current.startSession({ exercise: null })
    console.log('[Pipeline] repCounter started')

    const interval = setInterval(() => {
      const ref = poseLandmarksRef.current
      if (!ref) return

      const buffer = ref.getLandmarksBuffer()
      setInferenceMs(ref.getLastInferenceTimeMs())

      if (!Array.isArray(buffer) || buffer.length !== LANDMARK_COUNT * VALUES_PER_LANDMARK) {
        return
      }

      setLandmarksCount(Math.floor(buffer.length / VALUES_PER_LANDMARK))

      exerciseRecognition.ingestLandmarksBuffer(buffer)
      const exercise = exerciseRecognition.getCurrentExercise() ?? null
      const exConfidence = exerciseRecognition.getCurrentConfidence()
      setCurrentExercise(exercise)
      setExerciseConfidence(exConfidence)
      setClassifierInferenceMs(exerciseRecognition.getLastClassifierInferenceTimeMs())

      if (!repCounterRef.current) return

      const state = repCounterRef.current.update(buffer, exercise)
      setPhase(state.phase)
      setReps(state.reps)
      setRepConfidence(state.confidence)
      setActiveArm(state.activeArm)

      if (state.phase === 'UP' || state.phase === 'DOWN') {
        tempoClassifier.update(state.phase, 30)
        setTempo(tempoClassifier.getCurrentTempo())
        setQuality(tempoClassifier.getCurrentQuality())
        console.log('[Pipeline] tempo update:', state.phase, tempoClassifier.getCurrentTempo(), tempoClassifier.getCurrentQuality())
      }

      if (exercise != null) {
        tempoClassifier.setExercise(exercise)
        console.log('[Pipeline] setExercise:', exercise)
      }
    }, 66)

    return () => {
      clearInterval(interval)
      console.log('[Pipeline] interval cleared')
    }
  }, [sessionActive])

  const onStart = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      )
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return
      }
    }
    exerciseRecognition.startSession({ enterConfidence: 0.40, exitConfidence: 0.30, enterFrames: 3 })
    setSessionActive(true)
  }, [])

  const onStop = useCallback(() => {
    setSessionActive(false)
    setTempo('unknown')
    setQuality(0)
    setPhase('UNKNOWN')
    setReps(0)
    setRepConfidence(0)
    setActiveArm(null)
    setCurrentExercise(null)
    setExerciseConfidence(0)
    tempoRepCountRef.current = 0
    if (repCounterRef.current) {
      repCounterRef.current.stopSession()
      repCounterRef.current = null
    }
    exerciseRecognition.stopSession()
  }, [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.hud}>
              <Text style={styles.title}>Tempo Classifier Pipeline</Text>

              <Text style={styles.sectionLabel}>TEMPO</Text>
              <Text style={styles.tempo}>{tempo.toUpperCase()}</Text>
              <Text style={styles.quality}>Confidence: {quality}%</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>EXERCISE</Text>
              <Text style={styles.exercise}>
                {currentExercise?.replace(/_/g, ' ') ?? 'detecting...'}
              </Text>
              <Text style={styles.meta}>
                Confidence: {(exerciseConfidence * 100).toFixed(1)}%
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>REP COUNTER</Text>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  Phase: <Text style={styles.statValue}>{phase}</Text>
                </Text>
                <Text style={styles.stat}>
                  Reps: <Text style={styles.statValue}>{reps}</Text>
                </Text>
                <Text style={styles.stat}>
                  Arm: <Text style={styles.statValue}>{activeArm ?? '--'}</Text>
                </Text>
              </View>
              <Text style={styles.meta}>Confidence: {(repConfidence * 100).toFixed(0)}%</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>PERFORMANCE</Text>
              <Text style={styles.meta}>
                Landmark inference: {inferenceMs >= 0 ? `${inferenceMs.toFixed(0)} ms` : '--'}
              </Text>
              <Text style={styles.meta}>
                Classifier inference: {classifierInferenceMs >= 0 ? `${classifierInferenceMs.toFixed(1)} ms` : '--'}
              </Text>
              <Text style={styles.meta}>
                Landmarks: {landmarksCount} / {LANDMARK_COUNT}
              </Text>
              <Text style={styles.meta}>
                Model: {modelLoaded ? 'loaded' : 'not loaded'}
              </Text>
            </View>

            <View style={styles.viewport}>
              <PoseLandmarksView
                hybridRef={callback((ref: any) => { poseLandmarksRef.current = ref })}
                style={StyleSheet.absoluteFill}
                isActive={sessionActive}
                enableSkeleton={true}
                skeletonColor="#3fd4ff"
                skeletonBoneThickness={3}
                landmarkColor="#ffca57"
                minVisibilityConfidence={0.5}
                modelSelection={0}
                delegateSelection={0}
                inferenceSampleRateHz={15}
                enableVisibilityRecovery={true}
                enableOneEuroFilter={true}
                enableMotionPrediction={true}
                oneEuroMinCutoff={1}
                oneEuroBeta={0.5}
                width={DEFAULT_SIZE.width}
                height={280}
              />
              {!sessionActive ? (
                <Text style={styles.placeholder}>Tap Start Session to begin</Text>
              ) : null}
            </View>

            <View style={styles.controls}>
              <View style={styles.button}>
                <Button title="Start Session" onPress={onStart} disabled={sessionActive} />
              </View>
              <View style={styles.button}>
                <Button title="Stop Session" onPress={onStop} disabled={!sessionActive} />
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a1118',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hud: {
    marginBottom: 12,
    backgroundColor: '#112131',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dceeff',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6a8ca3',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 2,
  },
  tempo: {
    fontSize: 48,
    fontWeight: '900',
    color: '#f7fff8',
    lineHeight: 50,
  },
  quality: {
    fontSize: 22,
    fontWeight: '700',
    color: '#79f0b3',
    marginBottom: 4,
  },
  exercise: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f7fff8',
    lineHeight: 32,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stat: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f6d66b',
  },
  statValue: {
    color: '#f7fff8',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
    color: '#97adc1',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e3850',
    marginVertical: 6,
  },
  viewport: {
    position: 'relative',
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0e1d2a',
    borderWidth: 1,
    borderColor: '#203446',
  },
  placeholder: {
    color: '#8ea4b6',
    fontSize: 17,
    textAlign: 'center',
    marginTop: '45%',
  },
  controls: {
    marginTop: 12,
    marginBottom: 6,
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
})

export default App
