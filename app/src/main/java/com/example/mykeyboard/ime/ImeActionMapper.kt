package com.example.mykeyboard.ime

import android.text.InputType
import android.view.inputmethod.EditorInfo

enum class ImeAction(
    val label: String,
    val editorActionId: Int
) {
    Search("Search", EditorInfo.IME_ACTION_SEARCH),
    Send("Send", EditorInfo.IME_ACTION_SEND),
    Done("Done", EditorInfo.IME_ACTION_DONE),
    Go("Go", EditorInfo.IME_ACTION_GO),
    Next("Next", EditorInfo.IME_ACTION_NEXT),
    Enter("↵", EditorInfo.IME_ACTION_UNSPECIFIED)
}

object ImeActionMapper {

    fun resolve(imeOptions: Int, inputType: Int): ImeAction {
        val action = imeOptions and EditorInfo.IME_MASK_ACTION
        val noEnterAction = imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0
        val multiLine = inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE != 0

        if (multiLine && (noEnterAction || action == EditorInfo.IME_ACTION_UNSPECIFIED)) {
            return ImeAction.Enter
        }

        return when (action) {
            EditorInfo.IME_ACTION_SEARCH -> ImeAction.Search
            EditorInfo.IME_ACTION_SEND -> ImeAction.Send
            EditorInfo.IME_ACTION_DONE -> ImeAction.Done
            EditorInfo.IME_ACTION_GO -> ImeAction.Go
            EditorInfo.IME_ACTION_NEXT -> ImeAction.Next
            else -> ImeAction.Enter
        }
    }
}
