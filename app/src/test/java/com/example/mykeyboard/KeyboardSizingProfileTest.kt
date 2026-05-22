package com.example.mykeyboard

import org.junit.Assert.assertTrue
import org.junit.Test

class KeyboardSizingProfileTest {

    @Test
    fun compactPhonesKeepErgonomicMinimumWithoutGrowingTooTall() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(sizing.keyHeightPx in 150..165)
        assertTrue(sizing.numberRowHeightPx < sizing.keyHeightPx)
        assertTrue(sizing.suggestionBarHeightPx < sizing.keyHeightPx)
        assertTrue(sizing.rowVerticalMarginPx <= 3)
    }

    @Test
    fun tallPhonesCompressInsteadOfStretchingRows() {
        val tall = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2600,
            density = 3f,
            smallestWidthDp = 360
        )
        val normal = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2160,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(tall.keyHeightPx <= normal.keyHeightPx)
        assertTrue(tall.panelTopPaddingPx <= normal.panelTopPaddingPx)
        assertTrue(tall.panelBottomPaddingPx <= normal.panelBottomPaddingPx)
    }

    @Test
    fun wideAndTabletScreensAreBoundedAgainstGiantKeys() {
        val widePhone = KeyboardSizingProfile.fromDevice(
            widthPx = 1440,
            heightPx = 3120,
            density = 3.5f,
            smallestWidthDp = 411
        )
        val tablet = KeyboardSizingProfile.fromDevice(
            widthPx = 1600,
            heightPx = 2560,
            density = 2f,
            smallestWidthDp = 800
        )

        assertTrue(widePhone.keyHeightPx <= (58 * 3.5f).toInt())
        assertTrue(tablet.keyHeightPx <= 120)
        assertTrue(tablet.numberRowHeightPx <= 60)
    }

    @Test
    fun rowHierarchyRemainsStableWithNumberStrip() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2280,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(sizing.numberRowHeightPx < sizing.suggestionBarHeightPx)
        assertTrue(sizing.suggestionBarHeightPx < sizing.keyHeightPx)
        assertTrue(sizing.homeRowSidePaddingPx > sizing.topRowSidePaddingPx)
        assertTrue(sizing.bottomRowSidePaddingPx >= sizing.topRowSidePaddingPx)
    }

    @Test
    fun densityProfileKeepsOuterPaddingAndGapsCompact() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2280,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(sizing.panelHorizontalPaddingPx <= 12)
        assertTrue(sizing.panelTopPaddingPx <= 3)
        assertTrue(sizing.panelBottomPaddingPx <= 3)
        assertTrue(sizing.keyHorizontalMarginPx in 2..4)
        assertTrue(sizing.rowVerticalMarginPx in 1..3)
        assertTrue(sizing.keyVerticalMarginPx in 1..2)
        assertTrue(sizing.suggestionHorizontalPaddingPx == sizing.panelHorizontalPaddingPx)
        assertTrue(sizing.numberRowHorizontalPaddingPx <= sizing.panelHorizontalPaddingPx)
        assertTrue(sizing.panelHorizontalPaddingPx >= sizing.keyHorizontalMarginPx * 2)
    }

    @Test
    fun visualRhythmUsesBoundedSpacingRelationships() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(sizing.rowVerticalMarginPx <= sizing.keyHorizontalMarginPx)
        assertTrue(sizing.rowVerticalMarginPx * 2 >= sizing.keyHorizontalMarginPx)
        assertTrue(sizing.keyVerticalMarginPx <= sizing.rowVerticalMarginPx)
        assertTrue(sizing.suggestionChipHorizontalMarginPx <= sizing.keyHorizontalMarginPx)
        assertTrue(sizing.keyHorizontalMarginPx >= sizing.rowVerticalMarginPx)
        assertTrue(sizing.suggestionChipVerticalMarginPx == sizing.keyVerticalMarginPx)
    }

    @Test
    fun rowHeightsKeepMatureVisualHierarchy() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )

        val numberRatio = sizing.numberRowHeightPx.toFloat() / sizing.keyHeightPx
        val suggestionRatio = sizing.suggestionBarHeightPx.toFloat() / sizing.keyHeightPx

        assertTrue(numberRatio in 0.48f..0.54f)
        assertTrue(suggestionRatio in 0.56f..0.62f)
        assertTrue(sizing.numberRowHeightPx >= 72)
        assertTrue(sizing.suggestionBarHeightPx > sizing.numberRowHeightPx)
    }

    @Test
    fun edgePaddingStaysBalancedAcrossRows() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )

        assertTrue(sizing.topRowSidePaddingPx == 0)
        assertTrue(sizing.homeRowSidePaddingPx > sizing.bottomRowSidePaddingPx)
        assertTrue(sizing.bottomRowSidePaddingPx >= sizing.panelHorizontalPaddingPx)
        assertTrue(sizing.numberRowHorizontalPaddingPx in 1..sizing.panelHorizontalPaddingPx)
    }

    @Test
    fun compactDensityDoesNotBreakErgonomicTouchHeight() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )
        val visualFillHeight = sizing.keyHeightPx - (sizing.keyVerticalMarginPx * 2)

        assertTrue(sizing.keyHeightPx >= 150)
        assertTrue(visualFillHeight >= 144)
        assertTrue(sizing.numberRowHeightPx >= 72)
        assertTrue(sizing.suggestionBarHeightPx >= 84)
    }

    @Test
    fun perceivedKeyboardStackStaysCompactWithoutReducingMainTouchHeight() {
        val sizing = KeyboardSizingProfile.fromDevice(
            widthPx = 1080,
            heightPx = 2400,
            density = 3f,
            smallestWidthDp = 360
        )
        val mainRowsHeight = sizing.keyHeightPx * 4
        val visualStackHeight = mainRowsHeight +
            sizing.numberRowHeightPx +
            sizing.suggestionBarHeightPx +
            sizing.panelTopPaddingPx +
            sizing.panelBottomPaddingPx +
            (sizing.rowVerticalMarginPx * 8)

        assertTrue(mainRowsHeight >= 600)
        assertTrue(visualStackHeight in 760..790)
    }
}
