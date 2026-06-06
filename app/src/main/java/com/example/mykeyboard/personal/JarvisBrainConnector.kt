package com.example.mykeyboard.personal

import android.util.Log
import android.os.SystemClock
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
    val voiceSummary: String,
    val executionIntent: String? = null,
    val fallbackMessage: String? = null
)

class JarvisBrainConnector(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(28, TimeUnit.SECONDS)
        .callTimeout(32, TimeUnit.SECONDS)
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
        realityDecision: JarvisRealityDecision? = null,
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
            realityDecision = realityDecision,
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
        realityDecision: JarvisRealityDecision?,
        attempt: Int,
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val body = JSONObject()
            .put("question", question.trim())
            .put("sessionId", sessionId)
            .putRealityDecision(realityDecision)
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

        val startedAtMs = SystemClock.elapsedRealtime()
        Log.i(TAG, "Founder Brain request started: session=$sessionId attempt=$attempt")
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                val reason = "network failure: ${e.javaClass.simpleName}: ${e.message.orEmpty()}"
                Log.w(TAG, "Founder Brain request failed after ${elapsedMs(startedAtMs)}ms: session=$sessionId attempt=$attempt reason=$reason")
                handleRetryOrFallback(reason, attempt, endpoint, token, question, sessionId, realityDecision, onAnswer, onFailure)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val responseBody = it.body?.string().orEmpty()
                    if (!it.isSuccessful) {
                        val reason = "HTTP ${it.code}: ${responseBody.take(MAX_LOGGED_RESPONSE_CHARS)}"
                        Log.w(TAG, "Founder Brain HTTP response after ${elapsedMs(startedAtMs)}ms: session=$sessionId attempt=$attempt status=${it.code}")
                        if (isRetryableHttpCode(it.code)) {
                            handleRetryOrFallback(reason, attempt, endpoint, token, question, sessionId, realityDecision, onAnswer, onFailure)
                        } else {
                            Log.w(TAG, "Founder Brain request failed without retry: $reason")
                            onAnswer(fallbackAnswer(reason))
                        }
                        return
                    }
                    try {
                        Log.i(TAG, "Founder Brain response received after ${elapsedMs(startedAtMs)}ms: session=$sessionId attempt=$attempt")
                        onAnswer(parseAnswer(JSONObject(responseBody), sessionId))
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
        realityDecision: JarvisRealityDecision?,
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        if (attempt < MAX_RETRY_ATTEMPTS) {
            val nextAttempt = attempt + 1
            val delayMs = retryDelayMs(attempt)
            Log.w(TAG, "Founder Brain request failed: $reason; retry=$nextAttempt delayMs=$delayMs")
            retryExecutor.schedule(
                {
                    sendQuestion(endpoint, token, question, sessionId, realityDecision, nextAttempt, onAnswer, onFailure)
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

    private fun parseAnswer(json: JSONObject, sessionId: String): JarvisBrainAnswer {
        val voiceSummary = json.optString("voiceSummary").trim()
        if (voiceSummary.isBlank()) {
            Log.w(TAG, "Founder Brain response missing required voiceSummary for session $sessionId")
            return fallbackAnswer("missing voiceSummary")
        }
        return JarvisBrainAnswer(
            voiceSummary = voiceSummary,
            executionIntent = json.optionalJsonValue("executionIntent"),
            fallbackMessage = json.optionalJsonValue("fallbackMessage")
        )
    }

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
            voiceSummary = JarvisBrainSpeechPolicy.SAFE_FALLBACK_MESSAGE,
            fallbackMessage = JarvisBrainSpeechPolicy.SAFE_FALLBACK_MESSAGE
        )

    private fun isRetryableHttpCode(code: Int): Boolean =
        code == 408 || code == 429 || code in 500..599

    private fun retryDelayMs(attempt: Int): Long =
        BASE_RETRY_DELAY_MS * (1L shl attempt)

    private fun elapsedMs(startedAtMs: Long): Long =
        SystemClock.elapsedRealtime() - startedAtMs

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        const val TAG = "AritenisJarvis"
        const val MAX_RETRY_ATTEMPTS = 1
        const val BASE_RETRY_DELAY_MS = 500L
        const val MAX_LOGGED_RESPONSE_CHARS = 180
    }
}

private fun JSONObject.optionalJsonValue(name: String): String? {
    if (!has(name) || isNull(name)) return null
    return opt(name)?.toString()?.trim()?.takeIf { it.isNotBlank() }
}

private fun JSONObject.putRealityDecision(decision: JarvisRealityDecision?): JSONObject {
    if (decision == null) return this
    return put(
        "truthRouter",
        JSONObject()
            .put("route", decision.route.name)
            .put("truth_status", decision.truthStatus)
            .put("sources_used", decision.sourcesUsed)
            .put("missing_data", decision.missingData)
            .put("safe_response_mode", decision.safeResponseMode)
            .put("awareness_attempted", decision.awarenessAttempted)
    )
}
