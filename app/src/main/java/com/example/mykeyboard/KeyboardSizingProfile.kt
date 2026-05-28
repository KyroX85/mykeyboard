package com.example.mykeyboard

import kotlin.math.roundToInt

data class KeyboardSizingProfile(
    val keyHeightPx: Int,
    val numberRowHeightPx: Int,
    val suggestionBarHeightPx: Int,
    val rowVerticalMarginPx: Int,
    val keyHorizontalMarginPx: Int,
    val keyVerticalMarginPx: Int,
    val panelHorizontalPaddingPx: Int,
    val panelTopPaddingPx: Int,
    val panelBottomPaddingPx: Int,
    val suggestionHorizontalPaddingPx: Int,
    val suggestionChipHorizontalMarginPx: Int,
    val suggestionChipVerticalMarginPx: Int,
    val numberRowHorizontalPaddingPx: Int,
    val topRowSidePaddingPx: Int,
    val homeRowSidePaddingPx: Int,
    val bottomRowSidePaddingPx: Int
) {
    companion object {
        fun fromDevice(
            widthPx: Int,
            heightPx: Int,
            density: Float,
            smallestWidthDp: Int
        ): KeyboardSizingProfile {
            val safeDensity = density.coerceAtLeast(1f)
            val widthDp = widthPx / safeDensity
            val heightDp = heightPx / safeDensity
            val isLandscape = widthDp > heightDp
            val aspectRatio = if (widthPx == 0) 1.8f else heightPx.toFloat() / widthPx
            val tallPhoneCompression = if (aspectRatio > 2.05f) 0.96f else 1f
            val tabletCompression = if (smallestWidthDp >= TABLET_SMALLEST_WIDTH_DP) 0.9f else 1f
            val landscapeCompression = if (isLandscape) 0.72f else 1f

            val minKeyDp = when {
                isLandscape -> 38f
                smallestWidthDp < COMPACT_SMALLEST_WIDTH_DP || widthDp < COMPACT_WIDTH_DP -> 45f
                else -> 48f
            }
            val maxKeyDp = when {
                isLandscape -> 44f
                smallestWidthDp >= TABLET_SMALLEST_WIDTH_DP -> 60f
                aspectRatio > 2.1f -> 55f
                else -> 58f
            }
            val baseKeyHeightDp = (widthDp * KEY_WIDTH_RATIO * tallPhoneCompression * tabletCompression * landscapeCompression)
                .coerceIn(minKeyDp, maxKeyDp)
            val keyHeightDp = fitKeyHeightToAvailableStack(
                baseKeyHeightDp = baseKeyHeightDp,
                minKeyDp = minKeyDp,
                heightDp = heightDp,
                isLandscape = isLandscape,
                isTablet = smallestWidthDp >= TABLET_SMALLEST_WIDTH_DP
            )

            val numberRowDp = (keyHeightDp * NUMBER_ROW_RATIO).coerceIn(if (isLandscape) 31f else 38f, 42f)
            val suggestionDp = (keyHeightDp * SUGGESTION_ROW_RATIO).coerceIn(if (isLandscape) 24f else 28f, 34f)
            val panelTopDp = if (isLandscape || aspectRatio > 2.05f) 0f else 1f
            val panelBottomDp = if (isLandscape || aspectRatio > 2.05f) 0f else 1f
            val panelHorizontalDp = when {
                widthDp < COMPACT_WIDTH_DP -> 2.5f
                widthDp >= WIDE_WIDTH_DP -> 4.5f
                else -> 3.5f
            }
            val keyGapDp = when {
                widthDp < COMPACT_WIDTH_DP -> 1f
                widthDp >= WIDE_WIDTH_DP -> 1.25f
                else -> 1.2f
            }
            val rowMarginDp = (keyGapDp * ROW_MARGIN_TO_GAP_RATIO)
                .coerceIn(if (isLandscape) 0.35f else 0.55f, if (isLandscape) 0.55f else 0.75f)
            val verticalInsetDp = if (keyHeightDp <= 49f) {
                0f
            } else {
                (keyGapDp * KEY_VERTICAL_INSET_TO_GAP_RATIO).coerceIn(0.35f, 0.5f)
            }
            val suggestionChipMarginDp = (keyGapDp * SUGGESTION_CHIP_MARGIN_TO_GAP_RATIO).coerceIn(0.8f, 1f)

            return KeyboardSizingProfile(
                keyHeightPx = keyHeightDp.toPx(safeDensity),
                numberRowHeightPx = numberRowDp.toPx(safeDensity),
                suggestionBarHeightPx = suggestionDp.toPx(safeDensity),
                rowVerticalMarginPx = rowMarginDp.toPx(safeDensity),
                keyHorizontalMarginPx = keyGapDp.toPx(safeDensity),
                keyVerticalMarginPx = verticalInsetDp.toPx(safeDensity),
                panelHorizontalPaddingPx = panelHorizontalDp.toPx(safeDensity),
                panelTopPaddingPx = panelTopDp.toPx(safeDensity),
                panelBottomPaddingPx = panelBottomDp.toPx(safeDensity),
                suggestionHorizontalPaddingPx = panelHorizontalDp.toPx(safeDensity),
                suggestionChipHorizontalMarginPx = suggestionChipMarginDp.toPx(safeDensity),
                suggestionChipVerticalMarginPx = verticalInsetDp.toPx(safeDensity),
                numberRowHorizontalPaddingPx = (panelHorizontalDp * NUMBER_ROW_PADDING_TO_PANEL_RATIO)
                    .toPx(safeDensity),
                topRowSidePaddingPx = 0,
                homeRowSidePaddingPx = (widthDp * HOME_ROW_SIDE_PADDING_RATIO).coerceIn(8f, 13f).toPx(safeDensity),
                bottomRowSidePaddingPx = (widthDp * BOTTOM_ROW_SIDE_PADDING_RATIO).coerceIn(3f, 7f).toPx(safeDensity)
            )
        }

        private fun Float.toPx(density: Float): Int = (this * density).roundToInt().coerceAtLeast(0)

        private fun fitKeyHeightToAvailableStack(
            baseKeyHeightDp: Float,
            minKeyDp: Float,
            heightDp: Float,
            isLandscape: Boolean,
            isTablet: Boolean
        ): Float {
            val maxStackDp = when {
                isLandscape -> (heightDp * LANDSCAPE_HEIGHT_RATIO).coerceIn(190f, 238f)
                isTablet -> (heightDp * TABLET_HEIGHT_RATIO).coerceIn(270f, 340f)
                else -> (heightDp * PORTRAIT_HEIGHT_RATIO).coerceIn(248f, 305f)
            }
            val estimatedStackDp = estimateStackHeight(baseKeyHeightDp, isLandscape)
            if (estimatedStackDp <= maxStackDp) return baseKeyHeightDp

            val scaled = baseKeyHeightDp * (maxStackDp / estimatedStackDp)
            return scaled.coerceAtLeast(minKeyDp)
        }

        private fun estimateStackHeight(keyHeightDp: Float, isLandscape: Boolean): Float {
            val numberRowDp = (keyHeightDp * NUMBER_ROW_RATIO).coerceIn(if (isLandscape) 31f else 38f, 42f)
            val suggestionDp = (keyHeightDp * SUGGESTION_ROW_RATIO).coerceIn(if (isLandscape) 24f else 28f, 34f)
            return (keyHeightDp * MAIN_ROW_COUNT) +
                numberRowDp +
                suggestionDp +
                (0.75f * ROW_GAP_COUNT)
        }

        private const val COMPACT_SMALLEST_WIDTH_DP = 360
        private const val TABLET_SMALLEST_WIDTH_DP = 600
        private const val COMPACT_WIDTH_DP = 360f
        private const val WIDE_WIDTH_DP = 430f
        private const val KEY_WIDTH_RATIO = 0.135f
        private const val NUMBER_ROW_RATIO = 0.82f
        private const val SUGGESTION_ROW_RATIO = 0.58f
        private const val ROW_MARGIN_TO_GAP_RATIO = 0.62f
        private const val KEY_VERTICAL_INSET_TO_GAP_RATIO = 0.38f
        private const val SUGGESTION_CHIP_MARGIN_TO_GAP_RATIO = 0.9f
        private const val NUMBER_ROW_PADDING_TO_PANEL_RATIO = 0.5f
        private const val HOME_ROW_SIDE_PADDING_RATIO = 0.030f
        private const val BOTTOM_ROW_SIDE_PADDING_RATIO = 0.014f
        private const val MAIN_ROW_COUNT = 4
        private const val ROW_GAP_COUNT = 8
        private const val PORTRAIT_HEIGHT_RATIO = 0.34f
        private const val TABLET_HEIGHT_RATIO = 0.30f
        private const val LANDSCAPE_HEIGHT_RATIO = 0.58f
    }
}
