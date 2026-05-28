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
        "\uD83D\uDE00", "\uD83D\uDE03", "\uD83D\uDE04", "\uD83D\uDE01",
        "\uD83D\uDE06", "\uD83D\uDE05", "\uD83E\uDD23", "\uD83D\uDE02",
        "\uD83E\uDD72", "\uD83D\uDE0A", "\uD83D\uDE07", "\uD83D\uDE09",
        "\uD83D\uDE0D", "\uD83E\uDD70", "\uD83D\uDE18", "\uD83E\uDD29",
        "\uD83D\uDE17", "\uD83D\uDE19", "\uD83D\uDE1A", "\u263A\uFE0F",
        "\uD83D\uDE42", "\uD83E\uDD17", "\uD83E\uDD14", "\uD83E\uDEE1",
        "\uD83D\uDE10", "\uD83D\uDE11", "\uD83D\uDE36", "\uD83D\uDE0F",
        "\uD83D\uDE2E\u200D\uD83D\uDCA8", "\uD83D\uDE25", "\uD83D\uDE2A", "\uD83E\uDD24"
    )

    val EMOJI_CATEGORIES = listOf(
        EmojiCategory(
            icon = "\uD83D\uDE03",
            emojis = listOf(
                "\uD83D\uDE00", "\uD83D\uDE03", "\uD83D\uDE04", "\uD83D\uDE01",
                "\uD83D\uDE06", "\uD83D\uDE05", "\uD83E\uDD23", "\uD83D\uDE02",
                "\uD83E\uDD72", "\uD83D\uDE0A", "\uD83D\uDE07", "\uD83D\uDE09",
                "\uD83D\uDE0D", "\uD83E\uDD70", "\uD83D\uDE18", "\uD83E\uDD29",
                "\uD83D\uDE17", "\uD83D\uDE19", "\uD83D\uDE1A", "\u263A\uFE0F",
                "\uD83D\uDE42", "\uD83E\uDD17", "\uD83E\uDD14", "\uD83E\uDEE1",
                "\uD83D\uDE10", "\uD83D\uDE11", "\uD83D\uDE36", "\uD83D\uDE0F",
                "\uD83D\uDE44", "\uD83D\uDE2C", "\uD83E\uDEE8", "\uD83E\uDD2D",
                "\uD83E\uDEE2", "\uD83E\uDEE3", "\uD83E\uDD2B", "\uD83E\uDD25",
                "\uD83D\uDE36\u200D\uD83C\uDF2B\uFE0F", "\uD83D\uDE0C", "\uD83D\uDE14", "\uD83D\uDE2A",
                "\uD83E\uDD24", "\uD83D\uDE34", "\uD83D\uDE37", "\uD83E\uDD12",
                "\uD83E\uDD15", "\uD83E\uDD22", "\uD83E\uDD2E", "\uD83E\uDD27",
                "\uD83E\uDD75", "\uD83E\uDD76", "\uD83E\uDD74", "\uD83D\uDE35",
                "\uD83D\uDE35\u200D\uD83D\uDCAB", "\uD83E\uDD2F", "\uD83E\uDD20", "\uD83E\uDD73",
                "\uD83E\uDD78", "\uD83D\uDE0E", "\uD83E\uDDD0", "\uD83D\uDE15",
                "\uD83E\uDEE4", "\uD83D\uDE1F", "\uD83D\uDE2E", "\uD83D\uDE2F",
                "\uD83D\uDE32", "\uD83D\uDE33", "\uD83E\uDD7A", "\uD83E\uDD79",
                "\uD83D\uDE26", "\uD83D\uDE27", "\uD83D\uDE28", "\uD83D\uDE30",
                "\uD83D\uDE25", "\uD83D\uDE22", "\uD83D\uDE2D", "\uD83D\uDE31",
                "\uD83D\uDE16", "\uD83D\uDE23", "\uD83D\uDE1E", "\uD83D\uDE13",
                "\uD83D\uDE29", "\uD83D\uDE2B", "\uD83E\uDD71", "\uD83D\uDE24",
                "\uD83D\uDE21", "\uD83D\uDE20", "\uD83E\uDD2C", "\uD83D\uDE08",
                "\uD83D\uDC7F", "\uD83D\uDC79", "\uD83D\uDC7B", "\uD83D\uDC7D",
                "\uD83D\uDCA9", "\uD83E\uDD21", "\uD83D\uDE3A", "\uD83D\uDE3B",
                "\uD83D\uDE3C", "\uD83D\uDE3D", "\uD83D\uDE3E", "\uD83D\uDE3F",
                "\uD83D\uDE40", "\uD83D\uDE41", "\uD83D\uDE2F", "\uD83D\uDE32"
            )
        ),
        EmojiCategory(
            icon = "\uD83D\uDC4D",
            emojis = listOf(
                "\uD83D\uDC4D", "\uD83D\uDC4E", "\uD83D\uDC4F", "\uD83D\uDE4F",
                "\uD83D\uDE4C", "\uD83D\uDC4C", "\uD83D\uDCAA", "\u270C\uFE0F",
                "\uD83E\uDD1D", "\u270D\uFE0F", "\uD83D\uDC4B", "\uD83E\uDEF6",
                "\uD83E\uDEF3", "\uD83E\uDEF5", "\uD83E\uDEF1", "\uD83E\uDEF2",
                "\uD83D\uDD90\uFE0F", "\uD83E\uDD18", "\uD83E\uDD1F", "\uD83E\uDD0C",
                "\uD83E\uDD0F", "\uD83E\uDD1A", "\u261D\uFE0F", "\u270B",
                "\u270A", "\uD83E\uDD1B", "\uD83D\uDC4A", "\uD83D\uDE4F",
                "\uD83D\uDE4C", "\uD83E\uDEB7", "\uD83E\uDEB5", "\uD83E\uDEB6",
                "\uD83E\uDDBE", "\uD83E\uDDBF", "\uD83E\uDDD1", "\uD83D\uDC68",
                "\uD83D\uDC69", "\uD83D\uDC66", "\uD83D\uDC67", "\uD83D\uDC76",
                "\uD83D\uDC75", "\uD83D\uDC74", "\uD83D\uDE4D", "\uD83D\uDE4E",
                "\uD83D\uDE45", "\uD83D\uDE46", "\uD83D\uDE4B", "\uD83D\uDE47",
                "\uD83D\uDE4E", "\uD83E\uDD26", "\uD83E\uDD37", "\uD83D\uDEB6",
                "\uD83C\uDFC3", "\uD83D\uDC83", "\uD83D\uDD7A", "\uD83E\uDDD8",
                "\uD83E\uDDD9", "\uD83E\uDDDB", "\uD83E\uDDDD", "\uD83E\uDDDE",
                "\uD83D\uDC6E", "\uD83D\uDC77", "\uD83D\uDC69\u200D\u2695\uFE0F", "\uD83D\uDC68\u200D\u2695\uFE0F"
            )
        ),
        EmojiCategory(
            icon = "\uD83D\uDC3B",
            emojis = listOf(
                "\uD83D\uDC36", "\uD83D\uDC31", "\uD83D\uDC2D", "\uD83D\uDC39",
                "\uD83D\uDC30", "\uD83E\uDD8A", "\uD83D\uDC3B", "\uD83D\uDC3C",
                "\uD83D\uDC2F", "\uD83E\uDD81", "\uD83D\uDC2E", "\uD83D\uDC37",
                "\uD83D\uDC14", "\uD83D\uDC24", "\uD83D\uDC1F", "\uD83D\uDC19",
                "\uD83D\uDC2C", "\uD83D\uDC33", "\uD83D\uDC0B", "\uD83E\uDD88",
                "\uD83D\uDC0A", "\uD83D\uDC22", "\uD83D\uDC0D", "\uD83E\uDD8E",
                "\uD83E\uDD95", "\uD83D\uDC0C", "\uD83E\uDD8B", "\uD83D\uDC1B",
                "\uD83D\uDC1D", "\uD83D\uDC1C", "\uD83E\uDD97", "\uD83D\uDD77\uFE0F",
                "\uD83E\uDD9F", "\uD83D\uDC90", "\uD83C\uDF38", "\uD83C\uDF39",
                "\uD83C\uDF3A", "\uD83C\uDF3B", "\uD83C\uDF37", "\uD83C\uDF3C",
                "\uD83C\uDF32", "\uD83C\uDF33", "\uD83C\uDF34", "\uD83C\uDF35",
                "\uD83C\uDF3F", "\u2618\uFE0F", "\uD83C\uDF31", "\uD83C\uDF40",
                "\uD83C\uDF0D", "\uD83C\uDF0E", "\uD83C\uDF0F", "\uD83C\uDF15",
                "\uD83C\uDF16", "\uD83C\uDF17", "\uD83C\uDF18", "\uD83C\uDF11",
                "\u2600\uFE0F", "\u26C5", "\u2601\uFE0F", "\u2B50",
                "\uD83C\uDF08", "\u2602\uFE0F", "\u26A1\uFE0F", "\u2744\uFE0F"
            )
        ),
        EmojiCategory(
            icon = "\uD83C\uDF4E",
            emojis = listOf(
                "\uD83C\uDF4E", "\uD83C\uDF4A", "\uD83C\uDF49", "\uD83C\uDF47",
                "\uD83C\uDF53", "\uD83E\uDD51", "\uD83C\uDF46", "\uD83C\uDF45",
                "\uD83C\uDF55", "\uD83C\uDF54", "\uD83C\uDF5F", "\uD83C\uDF69",
                "\uD83C\uDF70", "\u2615", "\uD83C\uDF7A", "\uD83E\uDD64",
                "\uD83C\uDF7F", "\uD83E\uDD6A", "\uD83C\uDF6B", "\uD83C\uDF6C",
                "\uD83C\uDF6D", "\uD83C\uDF66", "\uD83C\uDF67", "\uD83C\uDF68",
                "\uD83E\uDDC1", "\uD83E\uDDC0", "\uD83C\uDF2D", "\uD83C\uDF2E",
                "\uD83C\uDF2F", "\uD83E\uDD59", "\uD83C\uDF5C", "\uD83C\uDF5D",
                "\uD83C\uDF5B", "\uD83C\uDF72", "\uD83E\uDD58", "\uD83C\uDF73",
                "\uD83E\uDD5A", "\uD83E\uDD5E", "\uD83E\uDDD0", "\uD83C\uDF77",
                "\uD83E\uDD42", "\uD83E\uDD43", "\uD83E\uDED6", "\uD83E\uDED7",
                "\uD83C\uDF4C", "\uD83E\uDED0", "\uD83E\uDED1", "\uD83C\uDF52",
                "\uD83E\uDD65", "\uD83E\uDD6F", "\uD83E\uDD60", "\uD83E\uDD5D",
                "\uD83E\uDD5C", "\uD83E\uDD6E", "\uD83C\uDF5A", "\uD83C\uDF63",
                "\uD83C\uDF64", "\uD83E\uDD6B", "\uD83C\uDF79", "\uD83E\uDDC3",
                "\uD83E\uDDC9", "\uD83E\uDDCA", "\uD83C\uDF7D\uFE0F", "\uD83E\uDD62"
            )
        ),
        EmojiCategory(
            icon = "\u2699\uFE0F",
            emojis = listOf(
                "\uD83D\uDCF1", "\uD83D\uDCBB", "\u2328\uFE0F", "\uD83D\uDDA5\uFE0F",
                "\uD83D\uDCFD\uFE0F", "\uD83D\uDCF7", "\uD83D\uDCF8", "\uD83C\uDFA7",
                "\uD83D\uDD0B", "\uD83D\uDD26\uFE0F", "\u2699\uFE0F", "\uD83D\uDEE0\uFE0F",
                "\uD83D\uDCE6", "\uD83D\uDCBC", "\u2705", "\uD83D\uDCC1",
                "\uD83D\uDCD6", "\uD83D\uDCD5", "\uD83D\uDCDC", "\uD83D\uDCC4",
                "\uD83D\uDCCB", "\uD83D\uDCC8", "\uD83D\uDCC9", "\uD83D\uDCCA",
                "\uD83D\uDCC2", "\uD83D\uDCC3", "\uD83D\uDCC5", "\uD83D\uDCC6",
                "\u23F0", "\u23F1\uFE0F", "\u23F2\uFE0F", "\u23F3",
                "\uD83D\uDD12", "\uD83D\uDD13", "\uD83D\uDD11", "\uD83D\uDDE1\uFE0F",
                "\uD83D\uDEE1\uFE0F", "\u26CF\uFE0F", "\u2692\uFE0F", "\u2696\uFE0F",
                "\uD83D\uDE97", "\uD83D\uDE95", "\uD83D\uDE8C", "\uD83D\uDE89",
                "\u2708\uFE0F", "\uD83D\uDE80", "\uD83D\uDEF8", "\u26F5",
                "\uD83D\uDEA2", "\uD83D\uDEA6", "\uD83D\uDEA5", "\uD83D\uDEE3\uFE0F",
                "\uD83D\uDD0D", "\uD83D\uDD2D", "\uD83D\uDC8A", "\uD83E\uDE79",
                "\uD83E\uDDF8", "\uD83E\uDDEA", "\uD83D\uDD2C", "\uD83D\uDD2E",
                "\uD83D\uDFAE", "\uD83C\uDFAE", "\uD83D\uDCB8", "\uD83D\uDCB3",
                "\uD83D\uDCB3", "\uD83D\uDCB6", "\uD83D\uDC8E", "\uD83D\uDD31"
            )
        ),
        EmojiCategory(
            icon = "\u2764\uFE0F",
            emojis = listOf(
                HEART, "\uD83E\uDDE1", "\uD83D\uDC9B", "\uD83D\uDC9A",
                "\uD83D\uDC99", "\uD83D\uDC9C", "\uD83D\uDDA4", SPARKLES,
                "\uD83D\uDD25", "\uD83C\uDF89", "\uD83D\uDCAF", "\uD83C\uDF1F",
                BOLT, "\uD83E\uDD73", "\uD83D\uDE0E", "\uD83E\uDD29",
                "\uD83C\uDFC6", "\uD83C\uDFC5", "\uD83C\uDF96\uFE0F", "\uD83C\uDFAF",
                "\u26BD", "\u26BE", "\uD83C\uDFC0", "\uD83C\uDFC8",
                "\uD83C\uDFBE", "\uD83C\uDFB1", "\uD83C\uDFF8", "\uD83E\uDD4A",
                "\u2660\uFE0F", "\u2665\uFE0F", "\u2666\uFE0F", "\u2663\uFE0F",
                "\uD83D\uDCB0", "\uD83D\uDCB8", "\uD83D\uDCB5", "\uD83D\uDCB4",
                "\u00A9\uFE0F", "\u00AE\uFE0F", "\u2122\uFE0F", "\u3030\uFE0F",
                "\u27BF", "\u267B\uFE0F", "\u267E\uFE0F", "\u26A0\uFE0F",
                "\u26A1", "\u2757", "\u2753", "\u2755",
                "\uD83C\uDFF3\uFE0F", "\uD83C\uDFF4", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEE\uD83C\uDDF3",
                "\uD83C\uDDEC\uD83C\uDDE7", "\uD83C\uDDEF\uD83C\uDDF5", "\uD83C\uDDEB\uD83C\uDDF7", "\uD83C\uDDE6\uD83C\uDDEA",
                "\uD83C\uDDE8\uD83C\uDDE6", "\uD83C\uDDE9\uD83C\uDDEA", "\uD83C\uDDE7\uD83C\uDDF7", "\uD83C\uDDF2\uD83C\uDDFD",
                "\uD83C\uDDE6\uD83C\uDDFA", "\uD83C\uDDE8\uD83C\uDDF3", "\uD83C\uDDEA\uD83C\uDDF8", "\uD83C\uDDEE\uD83C\uDDF9",
                "\uD83D\uDD1F", "\uD83D\uDD30", "\uD83D\uDD34", "\uD83D\uDFE2",
                "\uD83D\uDFE1", "\uD83D\uDFE0", "\uD83D\uDD35", "\uD83D\uDFE3"
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
