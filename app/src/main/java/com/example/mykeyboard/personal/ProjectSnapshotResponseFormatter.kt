package com.example.mykeyboard.personal

object ProjectSnapshotResponseFormatter {
    fun voiceSummary(snapshot: ProjectSnapshot): String =
        ProjectOperationalResponseMode.buildAnswer(snapshot)
}
