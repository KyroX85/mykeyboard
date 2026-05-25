package com.example.mykeyboard

object KeyboardSymbols {
    data class EmojiCategory(val icon: String, val emojis: List<String>)
    const val SHIFT = "\u21E7"
    const val BACKSPACE = "\u232B"
    const val ENTER = "\u23CE"
    const val EMOJI = "\u263A"
    const val SPACE = "space"

    const val RUPEE = "\u20B9"
    const val EURO = "\u20AC"
    const val POUND = "\u00A3"
    const val BULLET = "\u2022"
    const val SQUARE_ROOT = "\u221A"
    const val PI = "\u03C0"
    const val DIVIDE = "\u00F7"
    const val HEART = "\u2764\uFE0F"
    const val SPARKLES = "\u2728"
    const val BOLT = "\u26A1"
    const val CHECK = "\u2705"

    val EMOJI_PANEL = listOf(
        "\uD83D\uDE00", "\uD83D\uDE01", "\uD83D\uDE02", "\uD83E\uDD23",
        "\uD83D\uDE0A", "\uD83D\uDE0D", "\uD83D\uDE18", "\uD83D\uDE0E",
        "\uD83D\uDE22", "\uD83D\uDE2D", "\uD83D\uDE21", "\uD83D\uDC4D",
        "\uD83D\uDC4E", "\uD83D\uDE4F", "\uD83D\uDC4F", "\uD83D\uDD25",
        HEART, SPARKLES, "\uD83C\uDF89", "\uD83D\uDCAF",
        "\uD83D\uDE34", "\uD83E\uDD14", "\uD83D\uDE2C", "\uD83D\uDE07",
        "\uD83D\uDE4C", "\uD83D\uDC4C", "\uD83D\uDCAA", "\uD83C\uDF1F",
        BOLT, "\uD83D\uDCF7", "\uD83D\uDCBC", CHECK
    )

    val EMOJI_CATEGORIES = listOf(
        EmojiCategory(
            icon = "\uD83D\uDE03",
            emojis = listOf(
                "\uD83D\uDE00", "\uD83D\uDE03", "\uD83D\uDE04", "\uD83D\uDE01",
                "\uD83D\uDE06", "\uD83D\uDE05", "\uD83E\uDD23", "\uD83D\uDE02",
                "\uD83D\uDE42", "\uD83D\uDE0A", "\uD83D\uDE07", "\uD83D\uDE09",
                "\uD83D\uDE0D", "\uD83E\uDD70", "\uD83D\uDE18", "\uD83D\uDE17"
            )
        ),
        EmojiCategory(
            icon = "\uD83D\uDC4D",
            emojis = listOf(
                "\uD83D\uDC4D", "\uD83D\uDC4E", "\uD83D\uDC4F", "\uD83D\uDE4F",
                "\uD83D\uDE4C", "\uD83D\uDC4C", "\uD83D\uDCAA", "\u270C\uFE0F",
                "\uD83E\uDD1D", "\u270D\uFE0F", "\uD83D\uDC4B", "\uD83E\uDEF6",
                "\uD83E\uDEF3", "\uD83E\uDEF5", "\uD83E\uDEF1", "\uD83D\uDCAA"
            )
        ),
        EmojiCategory(
            icon = "\uD83D\uDC3B",
            emojis = listOf(
                "\uD83D\uDC36", "\uD83D\uDC31", "\uD83D\uDC2D", "\uD83D\uDC39",
                "\uD83D\uDC30", "\uD83E\uDD8A", "\uD83D\uDC3B", "\uD83D\uDC3C",
                "\uD83D\uDC2F", "\uD83E\uDD81", "\uD83D\uDC2E", "\uD83D\uDC37",
                "\uD83D\uDC14", "\uD83D\uDC24", "\uD83D\uDC1F", "\uD83D\uDC19"
            )
        ),
        EmojiCategory(
            icon = "\uD83C\uDF4E",
            emojis = listOf(
                "\uD83C\uDF4E", "\uD83C\uDF4A", "\uD83C\uDF49", "\uD83C\uDF47",
                "\uD83C\uDF53", "\uD83E\uDD51", "\uD83C\uDF46", "\uD83C\uDF45",
                "\uD83C\uDF55", "\uD83C\uDF54", "\uD83C\uDF5F", "\uD83C\uDF69",
                "\uD83C\uDF70", "\u2615", "\uD83C\uDF7A", "\uD83E\uDD64"
            )
        ),
        EmojiCategory(
            icon = "\u2699\uFE0F",
            emojis = listOf(
                "\uD83D\uDCF1", "\uD83D\uDCBB", "\u2328\uFE0F", "\uD83D\uDDA5\uFE0F",
                "\uD83D\uDCFD\uFE0F", "\uD83D\uDCF7", "\uD83D\uDCF8", "\uD83C\uDFA7",
                "\uD83D\uDD0B", "\uD83D\uDD26\uFE0F", "\u2699\uFE0F", "\uD83D\uDEE0\uFE0F",
                "\uD83D\uDCE6", "\uD83D\uDCBC", "\u2705", "\uD83D\uDCC1"
            )
        ),
        EmojiCategory(
            icon = "\u2764\uFE0F",
            emojis = listOf(
                HEART, "\uD83E\uDDE1", "\uD83D\uDC9B", "\uD83D\uDC9A",
                "\uD83D\uDC99", "\uD83D\uDC9C", "\uD83D\uDDA4", SPARKLES,
                "\uD83D\uDD25", "\uD83C\uDF89", "\uD83D\uDCAF", "\uD83C\uDF1F",
                BOLT, "\uD83E\uDD73", "\uD83D\uDE0E", "\uD83E\uDD29"
            )
        )
    )

    fun accessibilityLabelForKey(key: String, enterLabel: String): String = when (key) {
        SHIFT -> "Shift"
        BACKSPACE -> "Backspace"
        ENTER -> enterLabel.ifBlank { "Enter" }
        EMOJI -> "Emoji keyboard"
        SPACE -> "Space"
        "123" -> "Numbers and symbols"
        "ABC" -> "Letters"
        "#+=" -> "More symbols"
        else -> LongPressSymbolMap.symbolFor(key)?.let { "$key, long press for ${symbolName(it)}" } ?: key
    }

    fun numberAccessibilityLabel(number: String): String = "Number $number"

    private fun symbolName(symbol: String): String = when (symbol) {
        "@" -> "at sign"
        ";" -> "semicolon"
        ":" -> "colon"
        "/" -> "slash"
        "&" -> "ampersand"
        "-" -> "hyphen"
        "(" -> "left parenthesis"
        ")" -> "right parenthesis"
        "\"" -> "quote"
        "#" -> "hash"
        "%" -> "percent"
        "!" -> "exclamation mark"
        "?" -> "question mark"
        "," -> "comma"
        "." -> "period"
        "'" -> "apostrophe"
        "{" -> "left brace"
        "}" -> "right brace"
        else -> symbol
    }
}
