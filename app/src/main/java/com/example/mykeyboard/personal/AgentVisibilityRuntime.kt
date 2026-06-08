package com.example.mykeyboard.personal

import com.example.mykeyboard.BuildConfig
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

data class AgentVisibilityEntry(
    val agentName: String,
    val currentTask: String? = null,
    val lastAction: String? = null,
    val lastSuccess: String? = null,
    val lastFailure: String? = null,
    val waitingReason: String? = null,
    val nextAction: String? = null
) {
    fun hasEvidence(): Boolean =
        listOf(currentTask, lastAction, lastSuccess, lastFailure, waitingReason, nextAction).any { it != null }
}

data class AgentVisibilitySnapshot(
    val agents: List<AgentVisibilityEntry>? = null,
    val lastVerifiedTimestamp: String? = null,
    val parseFailure: String? = null
) {
    fun missingFields(): List<String> = buildList {
        if (agents == null) add("agents")
        if (lastVerifiedTimestamp == null) add("last_verified_timestamp")
        if (parseFailure != null) add("valid_agent_visibility_json")
    }

    fun hasEvidence(): Boolean =
        agents?.any { it.hasEvidence() } == true || lastVerifiedTimestamp != null
}

interface AgentVisibilityBuildInfo {
    val agentVisibilityJson: String
    val agentVisibilityVerifiedAt: String
}

object AgentVisibilityRuntime {
    fun capture(buildInfo: AgentVisibilityBuildInfo = BuildConfigAgentVisibilityBuildInfo): AgentVisibilitySnapshot {
        val rawJson = buildInfo.agentVisibilityJson.nullIfBlank()
        if (rawJson == null) {
            return AgentVisibilitySnapshot(
                agents = null,
                lastVerifiedTimestamp = buildInfo.agentVisibilityVerifiedAt.nullIfBlank()
            )
        }

        return try {
            AgentVisibilitySnapshot(
                agents = JSONArray(rawJson).toAgentEntries(),
                lastVerifiedTimestamp = buildInfo.agentVisibilityVerifiedAt.nullIfBlank()
            )
        } catch (e: JSONException) {
            AgentVisibilitySnapshot(
                agents = null,
                lastVerifiedTimestamp = buildInfo.agentVisibilityVerifiedAt.nullIfBlank(),
                parseFailure = e.message?.take(MAX_PARSE_FAILURE_CHARS) ?: "invalid JSON"
            )
        }
    }

    private fun JSONArray.toAgentEntries(): List<AgentVisibilityEntry>? =
        (0 until length())
            .mapNotNull { index -> optJSONObject(index)?.toAgentEntry() }
            .filter { it.hasEvidence() }
            .takeIf { it.isNotEmpty() }

    private fun JSONObject.toAgentEntry(): AgentVisibilityEntry? {
        val agentName = optString("agentName")
            .ifBlank { optString("agent_name") }
            .ifBlank { optString("name") }
            .nullIfBlank()
            ?: return null

        return AgentVisibilityEntry(
            agentName = agentName,
            currentTask = firstPresentString("currentTask", "current_task"),
            lastAction = firstPresentString("lastAction", "last_action"),
            lastSuccess = firstPresentString("lastSuccess", "last_success"),
            lastFailure = firstPresentString("lastFailure", "last_failure"),
            waitingReason = firstPresentString("waitingReason", "waiting_reason"),
            nextAction = firstPresentString("nextAction", "next_action")
        )
    }

    private fun JSONObject.firstPresentString(vararg keys: String): String? =
        keys.firstNotNullOfOrNull { key -> optString(key).nullIfBlank() }

    private const val MAX_PARSE_FAILURE_CHARS = 120
}

object AgentVisibilityResponseFormatter {
    fun voiceSummary(snapshot: AgentVisibilitySnapshot): String {
        val agents = snapshot.agents
        if (agents.isNullOrEmpty()) {
            return "I do not have verified agent visibility yet."
        }

        return agents.take(MAX_AGENTS_IN_VOICE).joinToString(". ") { agent ->
            buildString {
                append(agent.agentName)
                append(": ")
                append("current task: ${agent.currentTask ?: "unknown"}")
                append("; progress: ${agent.lastSuccess ?: agent.lastAction ?: "unknown"}")
                append("; blocker: ${agent.lastFailure ?: agent.waitingReason ?: "none reported"}")
                agent.nextAction?.let { append("; next: $it") }
            }
        }.take(MAX_VOICE_CHARS)
    }

    private const val MAX_AGENTS_IN_VOICE = 4
    private const val MAX_VOICE_CHARS = 420
}

private object BuildConfigAgentVisibilityBuildInfo : AgentVisibilityBuildInfo {
    override val agentVisibilityJson: String = BuildConfig.AGENT_VISIBILITY_JSON
    override val agentVisibilityVerifiedAt: String = BuildConfig.AGENT_VISIBILITY_VERIFIED_AT
}

private fun String.nullIfBlank(): String? =
    trim().takeIf { it.isNotEmpty() }
