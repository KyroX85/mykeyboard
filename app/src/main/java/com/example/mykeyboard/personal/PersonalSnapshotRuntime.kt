package com.example.mykeyboard.personal

import com.example.mykeyboard.BuildConfig

data class PersonalSnapshot(
    val userEnteredSchedule: List<String>? = null,
    val classTimings: List<String>? = null,
    val badmintonTimings: List<String>? = null,
    val jeeTimings: List<String>? = null,
    val homeworkTasks: List<String>? = null,
    val manualCommitments: List<String>? = null,
    val lastVerifiedTimestamp: String? = null
) {
    fun missingFields(): List<String> = buildList {
        if (userEnteredSchedule == null) add("user_entered_schedule")
        if (classTimings == null) add("class_timings")
        if (badmintonTimings == null) add("badminton_timings")
        if (jeeTimings == null) add("jee_timings")
        if (homeworkTasks == null) add("homework_tasks")
        if (manualCommitments == null) add("manual_commitments")
        if (lastVerifiedTimestamp == null) add("last_verified_timestamp")
    }

    fun hasEvidence(): Boolean =
        userEnteredSchedule != null ||
            classTimings != null ||
            badmintonTimings != null ||
            jeeTimings != null ||
            homeworkTasks != null ||
            manualCommitments != null ||
            lastVerifiedTimestamp != null
}

interface PersonalSnapshotBuildInfo {
    val userEnteredSchedule: String
    val classTimings: String
    val badmintonTimings: String
    val jeeTimings: String
    val homeworkTasks: String
    val manualCommitments: String
    val snapshotVerifiedAt: String
}

object PersonalSnapshotRuntime {
    fun capture(buildInfo: PersonalSnapshotBuildInfo = BuildConfigPersonalSnapshotBuildInfo): PersonalSnapshot =
        PersonalSnapshot(
            userEnteredSchedule = buildInfo.userEnteredSchedule.toSnapshotList(),
            classTimings = buildInfo.classTimings.toSnapshotList(),
            badmintonTimings = buildInfo.badmintonTimings.toSnapshotList(),
            jeeTimings = buildInfo.jeeTimings.toSnapshotList(),
            homeworkTasks = buildInfo.homeworkTasks.toSnapshotList(),
            manualCommitments = buildInfo.manualCommitments.toSnapshotList(),
            lastVerifiedTimestamp = buildInfo.snapshotVerifiedAt.nullIfBlank()
        )
}

object PersonalSnapshotResponseFormatter {
    fun voiceSummary(snapshot: PersonalSnapshot, question: String): String {
        if (!snapshot.hasEvidence()) {
            return "I do not have enough verified personal data yet."
        }

        val normalized = question.normalizedForPersonalQuestion()
        val answer = when {
            normalized.contains("classes") || normalized.contains("class") ->
                classesLeftAnswer(snapshot)
            normalized.contains("focus") ->
                focusAnswer(snapshot)
            normalized.contains("pending") || normalized.contains("left today") ->
                pendingTodayAnswer(snapshot)
            else ->
                pendingTodayAnswer(snapshot)
        }

        return answer.take(MAX_VOICE_CHARS)
    }

    private fun pendingTodayAnswer(snapshot: PersonalSnapshot): String {
        val pending = buildList {
            snapshot.homeworkTasks?.takeIf { it.isNotEmpty() }?.let {
                add("homework: ${it.joinToString(", ")}")
            }
            snapshot.manualCommitments?.takeIf { it.isNotEmpty() }?.let {
                add("commitments: ${it.joinToString(", ")}")
            }
            snapshot.userEnteredSchedule?.takeIf { it.isNotEmpty() }?.let {
                add("schedule: ${it.joinToString(", ")}")
            }
        }
        if (pending.isEmpty()) {
            return "I have verified personal data, but no pending homework or commitments were provided."
        }
        return "Pending today: ${pending.joinToString("; ")}."
    }

    private fun focusAnswer(snapshot: PersonalSnapshot): String =
        snapshot.homeworkTasks?.firstOrNull()?.let { "Focus on homework first: $it." }
            ?: snapshot.jeeTimings?.firstOrNull()?.let { "Focus on JEE timing: $it." }
            ?: snapshot.classTimings?.firstOrNull()?.let { "Next verified class timing: $it." }
            ?: snapshot.manualCommitments?.firstOrNull()?.let { "Focus on commitment: $it." }
            ?: "I have verified personal data, but no focus item was provided."

    private fun classesLeftAnswer(snapshot: PersonalSnapshot): String =
        snapshot.classTimings?.takeIf { it.isNotEmpty() }?.let {
            "Verified class timings: ${it.joinToString(", ")}."
        } ?: "I do not have verified class timings yet."

    private fun String.normalizedForPersonalQuestion(): String =
        lowercase()
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private const val MAX_VOICE_CHARS = 260
}

private object BuildConfigPersonalSnapshotBuildInfo : PersonalSnapshotBuildInfo {
    override val userEnteredSchedule: String = BuildConfig.PERSONAL_SCHEDULE
    override val classTimings: String = BuildConfig.PERSONAL_CLASS_TIMINGS
    override val badmintonTimings: String = BuildConfig.PERSONAL_BADMINTON_TIMINGS
    override val jeeTimings: String = BuildConfig.PERSONAL_JEE_TIMINGS
    override val homeworkTasks: String = BuildConfig.PERSONAL_HOMEWORK_TASKS
    override val manualCommitments: String = BuildConfig.PERSONAL_MANUAL_COMMITMENTS
    override val snapshotVerifiedAt: String = BuildConfig.PERSONAL_SNAPSHOT_VERIFIED_AT
}

private fun String.nullIfBlank(): String? =
    trim().takeIf { it.isNotEmpty() }

private fun String.toSnapshotList(): List<String>? =
    split("|", ";")
        .mapNotNull { it.nullIfBlank() }
        .takeIf { it.isNotEmpty() }
