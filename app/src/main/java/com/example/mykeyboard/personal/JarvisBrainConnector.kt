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
import java.util.concurrent.TimeUnit

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
        .build()
) {
    fun askQuestion(
        question: String,
        onAnswer: (JarvisBrainAnswer) -> Unit,
        onFailure: (String) -> Unit
    ) {
        val endpoint = PersonalJarvisConfig.founderBrainQuestionEndpoint()
        val token = PersonalJarvisConfig.founderBrainApiToken()
        if (endpoint.isBlank() || token.isBlank()) {
            onFailure("Founder Brain is not connected.")
            return
        }

        val body = JSONObject()
            .put("question", question.trim())
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)

        val request = Request.Builder()
            .url(endpoint)
            .post(body)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "Founder Brain request failed", e)
                onFailure("Founder Brain did not respond.")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        onFailure("Founder Brain returned ${it.code}.")
                        return
                    }
                    try {
                        val json = JSONObject(it.body?.string().orEmpty())
                        onAnswer(
                            JarvisBrainAnswer(
                                type = json.optString("type", "unclear"),
                                summary = json.optString("summary"),
                                voiceSummary = json.optString("voiceSummary").ifBlank {
                                    json.optString("summary", "Founder Brain responded.")
                                },
                                confidence = json.optDouble("confidence", 0.0)
                            )
                        )
                    } catch (e: RuntimeException) {
                        Log.w(TAG, "Founder Brain response parsing failed", e)
                        onFailure("Founder Brain response was not readable.")
                    }
                }
            }
        })
    }

    fun shutdown() {
        client.dispatcher.executorService.shutdown()
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        const val TAG = "AritenisJarvis"
    }
}
