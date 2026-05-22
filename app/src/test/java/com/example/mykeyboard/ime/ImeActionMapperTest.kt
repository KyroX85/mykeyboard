package com.example.mykeyboard.ime

import android.text.InputType
import android.view.inputmethod.EditorInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class ImeActionMapperTest {

    @Test
    fun mapsExplicitEditorActions() {
        assertEquals(ImeAction.Search, ImeActionMapper.resolve(EditorInfo.IME_ACTION_SEARCH, 0))
        assertEquals(ImeAction.Send, ImeActionMapper.resolve(EditorInfo.IME_ACTION_SEND, 0))
        assertEquals(ImeAction.Done, ImeActionMapper.resolve(EditorInfo.IME_ACTION_DONE, 0))
        assertEquals(ImeAction.Go, ImeActionMapper.resolve(EditorInfo.IME_ACTION_GO, 0))
        assertEquals(ImeAction.Next, ImeActionMapper.resolve(EditorInfo.IME_ACTION_NEXT, 0))
    }

    @Test
    fun keepsPlainAndNoEnterMultilineFieldsAsNewline() {
        val multiline = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE

        assertEquals(ImeAction.Enter, ImeActionMapper.resolve(EditorInfo.IME_ACTION_UNSPECIFIED, multiline))
        assertEquals(
            ImeAction.Enter,
            ImeActionMapper.resolve(EditorInfo.IME_ACTION_SEND or EditorInfo.IME_FLAG_NO_ENTER_ACTION, multiline)
        )
    }

    @Test
    fun usesExplicitActionForSingleLineFields() {
        assertEquals(
            ImeAction.Send,
            ImeActionMapper.resolve(
                EditorInfo.IME_ACTION_SEND,
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_SHORT_MESSAGE
            )
        )
    }

    @Test
    fun exposesCompactLabelsForActionKey() {
        assertEquals("Search", ImeAction.Search.label)
        assertEquals("Send", ImeAction.Send.label)
        assertEquals("Done", ImeAction.Done.label)
        assertEquals("Go", ImeAction.Go.label)
        assertEquals("Next", ImeAction.Next.label)
        assertEquals("↵", ImeAction.Enter.label)
    }
}
