package com.margelo.nitro.tempoclassifier

import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

@DoNotStrip
object TempoClassifierAssets {
    @JvmStatic
    @DoNotStrip
    fun loadAssetAsString(assetName: String): String {
        val context = NitroModules.applicationContext
        if (context == null) {
            Log.e("tempo-classifier", "application context is null")
            return ""
        }

        return try {
            context.assets.open(assetName).bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.e("tempo-classifier", "failed to load asset $assetName: ${e.message}", e)
            ""
        }
    }
}
