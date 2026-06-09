package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisExecutionLayerV1Test {
    @Test
    fun parsesAllowedPhoneActions() {
        assertPlan("Call Mom", JarvisExecutionAction.CALL_CONTACT, "Mom")
        assertPlan("Open app Instagram", JarvisExecutionAction.OPEN_APP, "Instagram")
        assertPlan("Open https://example.com", JarvisExecutionAction.OPEN_URL, "https://example.com")
        assertPlan("Create reminder finish homework", JarvisExecutionAction.CREATE_REMINDER, "finish homework")
    }

    @Test
    fun parsesWhatsAppDraftWithoutSending() {
        val result = JarvisExecutionLayerV1.parse("Send WhatsApp Rahul saying I will be late")
        assertTrue(result is JarvisExecutionParseResult.Ready)
        val plan = (result as JarvisExecutionParseResult.Ready).plan

        assertEquals(JarvisExecutionAction.WHATSAPP_DRAFT, plan.action)
        assertEquals("Rahul", plan.target)
        assertEquals("I will be late", plan.payload)
        assertTrue(plan.confirmationPrompt().contains("draft", ignoreCase = true))
    }

    @Test
    fun rejectsForbiddenExternalActions() {
        listOf(
            "pay Rahul 500",
            "buy headphones",
            "delete all files",
            "place order for food"
        ).forEach { command ->
            assertTrue(command, JarvisExecutionLayerV1.parse(command) is JarvisExecutionParseResult.Rejected)
        }
    }

    @Test
    fun confirmationAndCancellationAreExplicit() {
        assertTrue(JarvisExecutionLayerV1.isConfirmation("yes"))
        assertTrue(JarvisExecutionLayerV1.isConfirmation("go ahead"))
        assertTrue(JarvisExecutionLayerV1.isCancellation("cancel"))
        assertTrue(JarvisExecutionLayerV1.isCancellation("do not do it"))
    }

    private fun assertPlan(command: String, action: JarvisExecutionAction, target: String) {
        val result = JarvisExecutionLayerV1.parse(command)
        assertTrue(command, result is JarvisExecutionParseResult.Ready)
        val plan = (result as JarvisExecutionParseResult.Ready).plan
        assertEquals(action, plan.action)
        assertEquals(target, plan.target)
    }
}
