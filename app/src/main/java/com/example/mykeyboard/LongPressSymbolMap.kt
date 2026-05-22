package com.example.mykeyboard

object LongPressSymbolMap {
    private val symbols = mapOf(
        "a" to "@",
        "s" to ";",
        "d" to ":",
        "f" to "/",
        "g" to "&",
        "h" to "-",
        "j" to "(",
        "k" to ")",
        "l" to "\"",
        "z" to "#",
        "x" to "%",
        "c" to "!",
        "v" to "?",
        "b" to ",",
        "n" to ".",
        "m" to "'",
        "[" to "{",
        "]" to "}"
    )

    fun symbolFor(key: String): String? = symbols[key.lowercase()]

    fun hintFor(key: String): String? = symbolFor(key)
}
