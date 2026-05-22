package com.example.mykeyboard

object KeyboardSymbols {
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
