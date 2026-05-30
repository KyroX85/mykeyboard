package com.example.mykeyboard.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileSearchMatcherTest {

    @Test
    fun ranksNaturalLanguageSchoolQueryAgainstFileAndFolderNames() {
        val results = FileSearchMatcher.rank(
            query = "Find my class 8 annual portions",
            candidates = listOf(
                candidate("IMG_20260530.jpg", "Pictures/Screenshots", "image/jpeg"),
                candidate("Annual_Portion_Class8.pdf", "Download/School", "application/pdf"),
                candidate("Class8_Annual_Syllabus.pdf", "Documents/School", "application/pdf")
            ),
            nowMillis = MAY_30_2026
        )

        assertEquals("Annual_Portion_Class8.pdf", results.first().candidate.displayName)
        assertTrue(results.take(2).all { it.score > 0 })
    }

    @Test
    fun understandsCommonIndianDocumentAliases() {
        val results = FileSearchMatcher.rank(
            query = "Find Aadhaar PDF",
            candidates = listOf(
                candidate("aadhar_card_front.pdf", "Download/Govt", "application/pdf"),
                candidate("receipt_photo.jpg", "Pictures/WhatsApp Images", "image/jpeg")
            ),
            nowMillis = MAY_30_2026
        )

        assertEquals("aadhar_card_front.pdf", results.first().candidate.displayName)
    }

    @Test
    fun usesTemporalAndSourceHintsForScreenshots() {
        val results = FileSearchMatcher.rank(
            query = "Find screenshots from yesterday",
            candidates = listOf(
                candidate("Screenshot_old.png", "Pictures/Screenshots", "image/png", modifiedAtMillis = MAY_20_2026),
                candidate("Screenshot_recent.png", "Pictures/Screenshots", "image/png", modifiedAtMillis = MAY_29_2026),
                candidate("IMG_recent.png", "Pictures/Camera", "image/png", modifiedAtMillis = MAY_29_2026)
            ),
            nowMillis = MAY_30_2026
        )

        assertEquals("Screenshot_recent.png", results.first().candidate.displayName)
    }

    private fun candidate(
        name: String,
        path: String,
        mime: String,
        modifiedAtMillis: Long = MAY_30_2026
    ): DeviceFileCandidate = DeviceFileCandidate(
        uriString = "content://test/$name",
        displayName = name,
        relativePath = path,
        mimeType = mime,
        modifiedAtMillis = modifiedAtMillis,
        sizeBytes = 1024L,
        source = path
    )

    private companion object {
        const val MAY_30_2026 = 1_779_750_000_000L
        const val MAY_29_2026 = MAY_30_2026 - 86_400_000L
        const val MAY_20_2026 = MAY_30_2026 - (10L * 86_400_000L)
    }
}
