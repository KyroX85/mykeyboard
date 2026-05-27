package com.example.mykeyboard.metrics

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * ProductSignalBridge
 * Bounded, low-overhead bridge between Keyboard Runtime and Local Product Intelligence DB.
 */
object ProductSignalBridge {
    private const val TAG = "ProductSignalBridge"
    private const val INGEST_URL = "http://localhost:3000/metrics/ingest"
    private val executor = Executors.newSingleThreadExecutor()

    fun emitAggregateSignal(snapshot: KeyboardUsageSnapshot) {
        executor.execute {
            try {
                val suggestionRejectCount =
                    (snapshot.suggestionImpressions - snapshot.suggestionClicks).coerceAtLeast(0L)
                val backspaceAfterAutocorrectRate = snapshot.rapidCorrectionBackspaces
                val signal = JSONObject().apply {
                    put("timestamp", System.currentTimeMillis())
                    put("correctionBurstCount", snapshot.repeatedCorrectionRuns)
                    put("swipeRetryCount", snapshot.swipeBackspaces)
                    put("swipeFailureCount", snapshot.swipeFailures)
                    put("averageSwipeResolveLatencyMs", snapshot.averageSwipeResolveLatencyMs)
                    put("worstSwipeResolveLatencyMs", snapshot.worstSwipeResolveLatencyMs)
                    put("symbolModeToggleCount", snapshot.symbolLayerSwitches)
                    put("responsivenessSpikeCount", snapshot.latencySpikeSuspicions)
                    put("longWordSwipeFailureRate", snapshot.longWordSwipeFailures)
                    put("suggestionRejectRate", suggestionRejectCount)
                    put("backspaceAfterAutocorrectRate", backspaceAfterAutocorrectRate)
                    put("subsystem", "keyboard-runtime")
                    put("severity", if (snapshot.backspacesPer100Commits > 20) "MEDIUM" else "LOW")
                }

                sendSignal(signal)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to prepare signal: ${e.message}")
            }
        }
    }

    private fun sendSignal(json: JSONObject) {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(INGEST_URL)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            
            connection.outputStream.use { os ->
                val input = json.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_NO_CONTENT) {
                Log.w(TAG, "Ingestion server returned code: $responseCode")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send signal: ${e.message}")
        } finally {
            connection?.disconnect()
        }
    }
}
