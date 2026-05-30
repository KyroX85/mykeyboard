package com.example.mykeyboard.execution

data class DeviceFileCandidate(
    val uriString: String,
    val displayName: String,
    val relativePath: String,
    val mimeType: String,
    val modifiedAtMillis: Long,
    val sizeBytes: Long,
    val source: String
)

data class FileSearchResult(
    val candidate: DeviceFileCandidate,
    val score: Int,
    val matchedTerms: List<String>
)
