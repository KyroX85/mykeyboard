package com.example.mykeyboard.execution

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import java.util.Locale

class DeviceFileFinder(private val context: Context) {

    fun search(query: String, limit: Int = DEFAULT_RESULT_LIMIT): List<FileSearchResult> {
        val candidates = loadRecentCandidates()
        return FileSearchMatcher.rank(query, candidates, limit = limit)
    }

    private fun loadRecentCandidates(): List<DeviceFileCandidate> {
        val resolver = context.contentResolver
        val collection = MediaStore.Files.getContentUri("external")
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.RELATIVE_PATH,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.DATE_MODIFIED,
            MediaStore.Files.FileColumns.SIZE
        )
        val results = ArrayList<DeviceFileCandidate>(MAX_CANDIDATES)

        resolver.query(
            collection,
            projection,
            null,
            null,
            "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"
        )?.use { cursor ->
            val idIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val nameIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val pathIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.RELATIVE_PATH)
            val mimeIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val modifiedIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
            val sizeIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)

            while (cursor.moveToNext() && results.size < MAX_CANDIDATES) {
                val id = cursor.getLong(idIndex)
                val name = cursor.getString(nameIndex).orEmpty()
                if (name.isBlank()) continue
                val path = cursor.getString(pathIndex).orEmpty()
                val mime = cursor.getString(mimeIndex).orEmpty()
                if (!isSearchableFile(name, mime, path)) continue
                val uri = ContentUris.withAppendedId(collection, id)
                results += DeviceFileCandidate(
                    uriString = uri.toString(),
                    displayName = name,
                    relativePath = path,
                    mimeType = mime,
                    modifiedAtMillis = cursor.getLong(modifiedIndex) * 1000L,
                    sizeBytes = cursor.getLong(sizeIndex).coerceAtLeast(0L),
                    source = sourceLabel(path, mime)
                )
            }
        }

        return results
    }

    private fun isSearchableFile(name: String, mime: String, path: String): Boolean {
        val text = "$name $mime $path".lowercase(Locale.US)
        return SEARCHABLE_HINTS.any(text::contains)
    }

    private fun sourceLabel(path: String, mime: String): String {
        val lowerPath = path.lowercase(Locale.US)
        return when {
            lowerPath.contains("screenshots") -> "Screenshots"
            lowerPath.contains("whatsapp") -> "WhatsApp media"
            lowerPath.contains("telegram") -> "Telegram media"
            lowerPath.contains("download") -> "Downloads"
            lowerPath.contains("document") -> "Documents"
            mime.startsWith("image") -> "Images"
            else -> path.ifBlank { "Device storage" }
        }
    }

    companion object {
        fun displayPath(candidate: DeviceFileCandidate): String =
            listOf(candidate.relativePath.trim('/'), candidate.displayName)
                .filter { it.isNotBlank() }
                .joinToString("/")

        fun uriFor(candidate: DeviceFileCandidate): Uri = Uri.parse(candidate.uriString)

        private const val MAX_CANDIDATES = 900
        private const val DEFAULT_RESULT_LIMIT = 8
        private val SEARCHABLE_HINTS = listOf(
            "pdf", "image", "jpeg", "jpg", "png", "webp", "screenshot", "download",
            "document", "whatsapp", "telegram", "aadhaar", "aadhar", "receipt", "ticket",
            "portion", "syllabus", "timetable", OpenableColumns.DISPLAY_NAME.lowercase(Locale.US)
        )
    }
}
