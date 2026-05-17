package com.margelo.nitro.tempoclassifier

import android.util.Log
import com.margelo.nitro.randomforest.RandomForestBridge
import org.json.JSONObject

class TempoClassifierEngine {
    private val TAG = "NitroTempoCls"

    private var modelLoaded = false
    private var exerciseClasses: List<String> = emptyList()
    private var phase: String = "UNKNOWN"
    private var phaseStart: Long? = null
    private var repStart: Long? = null
    private var midTime: Long? = null
    private var exercise: String? = null
    private var currentTempo: String = "unknown"
    private var currentQuality: Double = 0.0

    fun loadModel(modelJson: String): Boolean {
        Log.d(TAG, "loadModel(): begin")
        val ok = RandomForestBridge.loadModel(modelJson)
        if (!ok) { Log.d(TAG, "loadModel(): failed"); return false }
        try {
            val json = JSONObject(modelJson)
            val arr = json.optJSONArray("exercise_classes")
            if (arr != null) exerciseClasses = (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) {}
        modelLoaded = true
        currentTempo = "unknown"
        currentQuality = 0.0
        return true
    }

    fun setExercise(exerciseName: String?) {
        exercise = if (exerciseName.isNullOrEmpty()) null else exerciseName
    }

    fun update(phaseStr: String, fps: Double) {
        val now = System.nanoTime()
        val prev = phase
        val current = phaseStr

        if (current != prev) {
            if (prev == "UNKNOWN" && (current == "UP" || current == "DOWN")) {
                repStart = now; phaseStart = now; midTime = null
            } else if ((prev == "UP" || prev == "DOWN") && (current == "UP" || current == "DOWN")) {
                midTime = now; phaseStart = now
                val rs = repStart ?: return; val mt = midTime ?: return
                val totalS = (now - rs) / 1_000_000_000.0
                if (totalS > 0.3 && totalS < 15.0) {
                    val half1S = ((mt - rs) / 1_000_000_000.0).coerceAtLeast(0.05)
                    val half2S = (totalS - half1S).coerceAtLeast(0.05)
                    val halfRatio = half1S / half2S
                    val exEnc = if (exercise != null) exerciseClasses.indexOf(exercise).let { if (it >= 0) it else 0 } else 0
                    val flatData = doubleArrayOf(totalS, half1S, half2S, halfRatio, exEnc.toDouble())
                    val rawProbs = RandomForestBridge.predictProbabilities(flatData, 1, 5)
                    if (rawProbs != null && rawProbs.isNotEmpty()) {
                        var bi = 0; var bv = Float.NEGATIVE_INFINITY
                        for (i in rawProbs.indices) { val v = rawProbs[i].toFloat(); if (v > bv) { bv = v; bi = i } }
                        currentTempo = when (bi) { 0 -> "fast"; 1 -> "normal"; 2 -> "slow"; else -> "unknown" }
                        currentQuality = (bv * 100.0).toDouble()
                    }
                }
                repStart = now
            }
        }
        phase = current
    }

    fun getCurrentTempo(): String = currentTempo
    fun getCurrentQuality(): Double = currentQuality

    fun reset() {
        phase = "UNKNOWN"; phaseStart = null; repStart = null; midTime = null
        currentTempo = "unknown"; currentQuality = 0.0
    }
}
