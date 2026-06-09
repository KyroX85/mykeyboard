package com.example.mykeyboard.personal

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import java.util.Locale

enum class JarvisExecutionAction {
    CALL_CONTACT,
    OPEN_APP,
    WHATSAPP_DRAFT,
    OPEN_URL,
    CREATE_REMINDER
}

data class JarvisExecutionPlan(
    val action: JarvisExecutionAction,
    val target: String,
    val payload: String? = null
) {
    fun confirmationPrompt(): String =
        when (action) {
            JarvisExecutionAction.CALL_CONTACT -> "I can open the dialer for $target. Shall I call now?"
            JarvisExecutionAction.OPEN_APP -> "I found an app target: $target. Shall I open it?"
            JarvisExecutionAction.WHATSAPP_DRAFT -> "I can prepare a WhatsApp draft for $target. Shall I open it?"
            JarvisExecutionAction.OPEN_URL -> "I can open this URL: $target. Shall I open it?"
            JarvisExecutionAction.CREATE_REMINDER -> "I can create a reminder draft: $target. Shall I open it?"
        }
}

sealed class JarvisExecutionParseResult {
    data class Ready(val plan: JarvisExecutionPlan) : JarvisExecutionParseResult()
    data class NeedsClarification(val prompt: String) : JarvisExecutionParseResult()
    data class Rejected(val reason: String) : JarvisExecutionParseResult()
}

object JarvisExecutionLayerV1 {
    fun parse(command: String): JarvisExecutionParseResult {
        val normalized = command.normalizedForExecution()
        if (normalized.isBlank()) {
            return JarvisExecutionParseResult.NeedsClarification("What phone action should I prepare?")
        }
        if (containsForbiddenAction(normalized)) {
            return JarvisExecutionParseResult.Rejected("That action is outside Execution Layer V1.")
        }

        parseCall(command, normalized)?.let { return it }
        parseOpenUrl(command, normalized)?.let { return it }
        parseOpenApp(command, normalized)?.let { return it }
        parseWhatsAppDraft(command, normalized)?.let { return it }
        parseReminder(command, normalized)?.let { return it }

        return JarvisExecutionParseResult.NeedsClarification(
            "I can call, open an app, draft a WhatsApp message, open a URL, or create a reminder."
        )
    }

    fun isConfirmation(text: String): Boolean {
        val normalized = text.normalizedForExecution()
        return normalized == "yes" ||
            normalized == "confirm" ||
            normalized == "proceed" ||
            normalized == "do it" ||
            normalized == "go ahead" ||
            normalized == "call now" ||
            normalized == "open it" ||
            normalized == "send draft" ||
            normalized == "create it"
    }

    fun isCancellation(text: String): Boolean {
        val normalized = text.normalizedForExecution()
        return normalized == "no" ||
            normalized == "cancel" ||
            normalized == "stop" ||
            normalized == "never mind" ||
            normalized == "dont do it" ||
            normalized == "do not do it"
    }

    private fun parseCall(original: String, normalized: String): JarvisExecutionParseResult? {
        if (!normalized.startsWith("call ")) return null
        val contact = original.replace(Regex("^call\\s+", RegexOption.IGNORE_CASE), "").trim()
        return if (contact.isBlank()) {
            JarvisExecutionParseResult.NeedsClarification("Who should I call?")
        } else {
            JarvisExecutionParseResult.Ready(
                JarvisExecutionPlan(JarvisExecutionAction.CALL_CONTACT, target = contact)
            )
        }
    }

    private fun parseOpenApp(original: String, normalized: String): JarvisExecutionParseResult? {
        when {
            normalized.startsWith("open app ") -> "open app"
            normalized.startsWith("open ") -> "open"
            else -> return null
        }
        val app = original.replace(Regex("^open\\s+(app\\s+)?", RegexOption.IGNORE_CASE), "").trim()
        if (looksLikeUrl(app)) return null
        return if (app.isBlank()) {
            JarvisExecutionParseResult.NeedsClarification("Which app should I open?")
        } else {
            JarvisExecutionParseResult.Ready(
                JarvisExecutionPlan(JarvisExecutionAction.OPEN_APP, target = app)
            )
        }
    }

    private fun parseOpenUrl(original: String, normalized: String): JarvisExecutionParseResult? {
        val target = when {
            normalized.startsWith("open url ") -> original.replace(Regex("^open\\s+url\\s+", RegexOption.IGNORE_CASE), "").trim()
            normalized.startsWith("open website ") -> original.replace(Regex("^open\\s+website\\s+", RegexOption.IGNORE_CASE), "").trim()
            normalized.startsWith("open link ") -> original.replace(Regex("^open\\s+link\\s+", RegexOption.IGNORE_CASE), "").trim()
            normalized.startsWith("open ") -> original.replace(Regex("^open\\s+", RegexOption.IGNORE_CASE), "").trim().takeIf { looksLikeUrl(it) }
            else -> null
        } ?: return null
        return if (target.isBlank()) {
            JarvisExecutionParseResult.NeedsClarification("Which URL should I open?")
        } else {
            JarvisExecutionParseResult.Ready(
                JarvisExecutionPlan(JarvisExecutionAction.OPEN_URL, target = target.withUrlScheme())
            )
        }
    }

    private fun parseWhatsAppDraft(original: String, normalized: String): JarvisExecutionParseResult? {
        if (!normalized.startsWith("send whatsapp ") && !normalized.startsWith("whatsapp ")) return null
        val remainder = original
            .replace(Regex("^send\\s+whatsapp\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^whatsapp\\s+", RegexOption.IGNORE_CASE), "")
            .trim()
        if (remainder.isBlank()) {
            return JarvisExecutionParseResult.NeedsClarification("Who should receive the WhatsApp draft?")
        }
        val target = remainder
            .split(Regex("\\s+saying\\s+|\\s+message\\s+", RegexOption.IGNORE_CASE), limit = 2)
            .firstOrNull()
            ?.trim()
            .orEmpty()
        val message = when {
            remainder.contains(" saying ", ignoreCase = true) -> remainder.substringAfter(" saying ").trim()
            remainder.contains(" message ", ignoreCase = true) -> remainder.substringAfter(" message ").trim()
            else -> null
        }
        return JarvisExecutionParseResult.Ready(
            JarvisExecutionPlan(
                action = JarvisExecutionAction.WHATSAPP_DRAFT,
                target = target.ifBlank { "WhatsApp" },
                payload = message
            )
        )
    }

    private fun parseReminder(original: String, normalized: String): JarvisExecutionParseResult? {
        if (!normalized.startsWith("create reminder ") && !normalized.startsWith("remind me ")) return null
        val reminder = original
            .replace(Regex("^create\\s+reminder\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^remind\\s+me\\s+", RegexOption.IGNORE_CASE), "")
            .trim()
        return if (reminder.isBlank()) {
            JarvisExecutionParseResult.NeedsClarification("What should the reminder say?")
        } else {
            JarvisExecutionParseResult.Ready(
                JarvisExecutionPlan(JarvisExecutionAction.CREATE_REMINDER, target = reminder)
            )
        }
    }

    private fun containsForbiddenAction(normalized: String): Boolean =
        listOf("pay ", "payment", "transfer money", "buy ", "purchase", "delete ", "submit form", "place order")
            .any { normalized.contains(it) }

    private fun looksLikeUrl(value: String): Boolean {
        val trimmed = value.trim().lowercase(Locale.US)
        return trimmed.startsWith(HTTP_SCHEME) ||
            trimmed.startsWith(HTTPS_SCHEME) ||
            trimmed.contains(".com") ||
            trimmed.contains(".in") ||
            trimmed.contains(".org") ||
            trimmed.contains(".net")
    }

    private fun String.withUrlScheme(): String =
        if (startsWith(HTTP_SCHEME, ignoreCase = true) || startsWith(HTTPS_SCHEME, ignoreCase = true)) {
            this
        } else {
            "$HTTPS_SCHEME$this"
        }

    private fun String.normalizedForExecution(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s.:/?=&-]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private const val HTTP_SCHEME = "http" + "://"
    private const val HTTPS_SCHEME = "https" + "://"
}

class JarvisPhoneActionExecutor(private val context: Context) {
    fun execute(plan: JarvisExecutionPlan): Boolean {
        val intent = when (plan.action) {
            JarvisExecutionAction.CALL_CONTACT -> Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:${Uri.encode(plan.target)}")
            }
            JarvisExecutionAction.OPEN_APP -> resolveAppIntent(plan.target)
            JarvisExecutionAction.WHATSAPP_DRAFT -> Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("smsto:")
                setPackage("com.whatsapp")
                putExtra(Intent.EXTRA_TEXT, plan.payload.orEmpty())
            }
            JarvisExecutionAction.OPEN_URL -> Intent(Intent.ACTION_VIEW, Uri.parse(plan.target))
            JarvisExecutionAction.CREATE_REMINDER -> Intent(Intent.ACTION_INSERT).apply {
                data = CalendarContract.Events.CONTENT_URI
                putExtra(CalendarContract.Events.TITLE, plan.target)
            }
        } ?: return false

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }

    private fun resolveAppIntent(appName: String): Intent? {
        val normalized = appName.normalizedLabel()
        context.packageManager.getLaunchIntentForPackage(appName)?.let { return it }
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(launcherIntent, 0)
            .firstOrNull { info ->
                info.loadLabel(context.packageManager).toString().normalizedLabel().contains(normalized)
            }
            ?.activityInfo
            ?.let { activity ->
                Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    setClassName(activity.packageName, activity.name)
                }
            }
    }

    private fun String.normalizedLabel(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}
