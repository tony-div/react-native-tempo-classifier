package com.margelo.nitro.tempoclassifier

import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.*
import com.margelo.nitro.core.NullType

@DoNotStrip
class HybridTempoClassifier : HybridTempoClassifierSpec() {
    private val TAG = "NitroTempoCls"
    private val engine = TempoClassifierEngine()

    override fun loadModelFromJson(modelJson: String): Boolean {
        Log.d(TAG, "loadModelFromJson(): begin")
        return engine.loadModel(modelJson)
    }

    override fun loadModelFromAsset(assetName: String): Boolean {
        Log.d(TAG, "loadModelFromAsset(): asset=$assetName")
        val context = NitroModules.applicationContext ?: return false
        return try {
            val json = context.assets.open(assetName).bufferedReader().use { it.readText() }
            engine.loadModel(json)
        } catch (e: Exception) {
            Log.e(TAG, "loadModelFromAsset(): failed: ${e.message}")
            false
        }
    }

    override fun setExercise(exercise: Variant_NullType_String?) {
        engine.setExercise(exercise?.asSecondOrNull())
    }

    override fun update(phase: String, fps: Double?) {
        engine.update(phase, fps ?: 0.0)
    }

    override fun getCurrentTempo(): String {
        return engine.getCurrentTempo()
    }

    override fun getCurrentQuality(): Double {
        return engine.getCurrentQuality()
    }

    override fun reset() {
        engine.reset()
    }
}
