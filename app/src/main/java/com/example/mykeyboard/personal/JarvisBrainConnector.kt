package com.example.mykeyboard.personal

import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.UUID

data class JarvisBrainAnswer(
    val type: String,
    val summary: String,
    val voiceSummary: String,
    val confidence: Double
)

class JarvisBrainConnector(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .callTimeout(15, TimeUnit.SECONDS)
        .build(),
    private val retryExecutor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "JarvisBrainRetry").apply { isDaemon = true }
    }
) {
    fun initialize() {
        configurationIssue()?.let { issue ->
            Log.w(TAG, "Founder Brain connector initialized with configuration issue: $issue")
        } ?: Log.i(TAG, "Founder Brain connector initialized: endpoint=${PersonalJarvisConfig.founderBrainQuestionEndpoint()}; token=present")
    }

    fun askQuestion(
        question: String,
        sessionId: String = UUID.randomUUID().toString(),
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val endpoint = PersonalJarvisConfig.founderBrainQuestionEndpoint()
        val token = PersonalJarvisConfig.founderBrainApiToken()
        val issue = configurationIssue(endpoint, token)
        if (issue != null) {
            Log.w(TAG, "Founder Brain request blocked before network call: $issue")
            onAnswer(fallbackAnswer(issue))
            return
        }
        sendQuestion(
            endpoint = endpoint,
            token = token,
            question = question,
            sessionId = sessionId,
            attempt = 0,
            onAnswer = onAnswer,
            onFailure = onFailure
        )
    }

    private fun sendQuestion(
        endpoint: String,
        token: String,
        question: String,
        sessionId: String,
        attempt: Int,
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val body = JSONObject()
            .put("question", question.trim())
            .put("sessionId", sessionId)
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)

        val request = try {
            Request.Builder()
                .url(endpoint)
                .post(body)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("X-Aritenis-Session-Id", sessionId)
                .build()
        } catch (e: IllegalArgumentException) {
            val reason = "invalid Founder Brain endpoint: ${e.message.orEmpty()}"
            Log.w(TAG, reason, e)
            onAnswer(fallbackAnswer(reason))
            return
        }

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                val reason = "network failure: ${e.javaClass.simpleName}: ${e.message.orEmpty()}"
                handleRetryOrFallback(reason, attempt, endpoint, token, question, sessionId, onAnswer, onFailure)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val responseBody = it.body?.string().orEmpty()
                    if (!it.isSuccessful) {
                        val reason = "HTTP ${it.code}: ${responseBody.take(MAX_LOGGED_RESPONSE_CHARS)}"
                        if (isRetryableHttpCode(it.code)) {
                            handleRetryOrFallback(reason, attempt, endpoint, token, question, sessionId, onAnswer, onFailure)
                        } else {
                            Log.w(TAG, "Founder Brain request failed without retry: $reason")
                            onAnswer(fallbackAnswer(reason))
                        }
                        return
                    }
                    try {
                        val json = JSONObject(responseBody)
                        val voiceSummary = json.optString("voiceSummary").trim()
                        val summary = json.optString("summary").trim()
                        onAnswer(
                            JarvisBrainAnswer(
                                type = json.optString("type", "unclear"),
                                summary = summary.ifBlank { "Founder Brain responded without a text summary." },
                                voiceSummary = voiceSummary.ifBlank {
                                    Log.w(TAG, "Founder Brain response missing voiceSummary for session $sessionId")
                                    "Founder Brain responded, but the voice answer was empty."
                                },
                                confidence = json.optDouble("confidence", 0.0)
                            )
                        )
                    } catch (e: RuntimeException) {
                        val reason = "response parsing failure: ${e.javaClass.simpleName}: ${e.message.orEmpty()}"
                        Log.w(TAG, "Founder Brain response parsing failed: $reason", e)
                        onAnswer(fallbackAnswer(reason))
                    }
                }
            }
        })
    }

    private fun handleRetryOrFallback(
        reason: String,
        attempt: Int,
        endpoint: String,
        token: String,
        question: String,
        sessionId: String,
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        if (attempt < MAX_RETRY_ATTEMPTS) {
            val nextAttempt = attempt + 1
            val delayMs = retryDelayMs(attempt)
            Log.w(TAG, "Founder Brain request failed: $reason; retry=$nextAttempt delayMs=$delayMs")
            retryExecutor.schedule(
                {
                    sendQuestion(endpoint, token, question, sessionId, nextAttempt, onAnswer, onFailure)
                },
                delayMs,
                TimeUnit.MILLISECONDS
            )
            return
        }
        Log.w(TAG, "Founder Brain request exhausted retries: $reason")
        onAnswer(fallbackAnswer(reason))
    }

    fun shutdown() {
        client.dispatcher.executorService.shutdown()
        retryExecutor.shutdown()
    }

    fun isReady(): Boolean =
        configurationIssue() == null

    private fun configurationIssue(
        endpoint: String = PersonalJarvisConfig.founderBrainQuestionEndpoint(),
        token: String = PersonalJarvisConfig.founderBrainApiToken()
    ): String? =
        when {
            endpoint.isBlank() -> "ARITENIS_FOUNDER_BRAIN_API_URL was blank when this APK was built"
            token.isBlank() -> "ARITENIS_FOUNDER_BRAIN_API_TOKEN was blank when this APK was built"
            !endpoint.startsWith("https://") -> "Founder Brain endpoint must use HTTPS: $endpoint"
            else -> null
        }

    private fun fallbackAnswer(reason: String): JarvisBrainAnswer =
        JarvisBrainAnswer(
            type = "connection_fallback",
            summary = "Founder Brain unavailable. Reason: $reason",
            voiceSummary = fallbackVoiceSummary(reason),
            confidence = 0.0
        )

    private fun fallbackVoiceSummary(reason: String): String =
        when {
            reason.contains("API_URL") -> "Founder Brain API URL is missing from this APK build."
            reason.contains("API_TOKEN") -> "Founder Brain token is missing from this APK build."
            reason.contains("HTTP 401") || reason.contains("HTTP 403") -> "Founder Brain rejected the API token."
            reason.contains("invalid Founder Brain endpoint") -> "Founder Brain API URL is invalid."
            reason.contains("network failure") -> "Founder Brain could not be reached over the network."
            else -> "Founder Brain is unavailable right now."
        }

    private fun isRetryableHttpCode(code: Int): Boolean =
        code == 408 || code == 429 || code in 500..599

    private fun retryDelayMs(attempt: Int): Long =
        BASE_RETRY_DELAY_MS * (1L shl attempt)

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        const val TAG = "AritenisJarvis"
        const val MAX_RETRY_ATTEMPTS = 2
        const val BASE_RETRY_DELAY_MS = 500L
        const val MAX_LOGGED_RESPONSE_CHARS = 180
    }
}
