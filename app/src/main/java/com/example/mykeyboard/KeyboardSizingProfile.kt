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
            val aspectRatio = if (widthPx == 0) 1.8f else heightPx.toFloat() / widthPx
            val tallPhoneCompression = if (aspectRatio > 2.05f) 0.96f else 1f
            val tabletCompression = if (smallestWidthDp >= TABLET_SMALLEST_WIDTH_DP) 0.9f else 1f

            val minKeyDp = when {
                smallestWidthDp < COMPACT_SMALLEST_WIDTH_DP || widthDp < COMPACT_WIDTH_DP -> 47f
                else -> 50f
            }
            val maxKeyDp = when {
                smallestWidthDp >= TABLET_SMALLEST_WIDTH_DP -> 60f
                aspectRatio > 2.1f -> 55f
                else -> 58f
            }
            val keyHeightDp = (widthDp * KEY_WIDTH_RATIO * tallPhoneCompression * tabletCompression)
                .coerceIn(minKeyDp, maxKeyDp)

            val numberRowDp = (keyHeightDp * NUMBER_ROW_RATIO).coerceIn(24f, 28f)
            val suggestionDp = (keyHeightDp * SUGGESTION_ROW_RATIO).coerceIn(28f, 34f)
            val panelTopDp = if (aspectRatio > 2.05f) 0f else 1f
            val panelBottomDp = if (aspectRatio > 2.05f) 0f else 1f
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
            val rowMarginDp = (keyGapDp * ROW_MARGIN_TO_GAP_RATIO).coerceIn(0.65f, 0.9f)
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

        private const val COMPACT_SMALLEST_WIDTH_DP = 360
        private const val TABLET_SMALLEST_WIDTH_DP = 600
        private const val COMPACT_WIDTH_DP = 360f
        private const val WIDE_WIDTH_DP = 430f
        private const val KEY_WIDTH_RATIO = 0.135f
        private const val NUMBER_ROW_RATIO = 0.50f
        private const val SUGGESTION_ROW_RATIO = 0.58f
        private const val ROW_MARGIN_TO_GAP_RATIO = 0.75f
        private const val KEY_VERTICAL_INSET_TO_GAP_RATIO = 0.38f
        private const val SUGGESTION_CHIP_MARGIN_TO_GAP_RATIO = 0.9f
        private const val NUMBER_ROW_PADDING_TO_PANEL_RATIO = 0.5f
        private const val HOME_ROW_SIDE_PADDING_RATIO = 0.030f
        private const val BOTTOM_ROW_SIDE_PADDING_RATIO = 0.014f
    }
}
