package com.example.mykeyboard.metrics

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * ProductSignalBridge
 * Bounded, low-overhead bridge between Keyboard Runtime and Local Product Intelligence DB.
 */
object ProductSignalBridge {
    private const val TAG = "ProductSignalBridge"
    private const val CONNECT_TIMEOUT_MS = 500
    private const val READ_TIMEOUT_MS = 700
    private val INGEST_URLS = listOf(
        "http://10.0.2.2:3000/metrics/ingest",
        "http://localhost:3000/metrics/ingest"
    )
    private val executor = Executors.newSingleThreadExecutor()
    private val signalInFlight = AtomicBoolean(false)

    fun emitAggregateSignal(snapshot: KeyboardUsageSnapshot) {
        if (!signalInFlight.compareAndSet(false, true)) {
            Log.d(TAG, "Dropping product signal because delivery is already in flight")
            return
        }
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
            } finally {
                signalInFlight.set(false)
            }
        }
    }

    private fun sendSignal(json: JSONObject) {
        var delivered = false
        for (ingestUrl in INGEST_URLS) {
            if (trySendSignal(json, ingestUrl)) {
                delivered = true
                break
            }
        }
        if (!delivered) {
            Log.w(TAG, "No local product evidence ingestion endpoint accepted signal")
        }
    }

    private fun trySendSignal(json: JSONObject, ingestUrl: String): Boolean {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(ingestUrl)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            
            connection.outputStream.use { os ->
                val input = json.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_NO_CONTENT) {
                Log.w(TAG, "Ingestion server returned code: $responseCode")
                return false
            }
            return true
        } catch (e: Exception) {
            Log.d(TAG, "Product signal endpoint unavailable: ${e.message}")
            return false
        } finally {
            connection?.disconnect()
        }
    }
}
