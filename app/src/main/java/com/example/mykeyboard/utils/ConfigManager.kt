package com.example.mykeyboard.utils

import android.content.Context
import java.io.IOException
import java.util.Properties

object ConfigManager {

    private var properties: Properties? = null

    fun init(context: Context) {
        if (properties != null) return

        try {
            val props = Properties()
            context.assets.open("config.properties").use { inputStream ->
                props.load(inputStream)
            }
            properties = props
        } catch (e: IOException) {
            throw RuntimeException("Failed to load config.properties", e)
        }
    }

    fun getString(key: String, defaultValue: String = ""): String {
        return properties?.getProperty(key, defaultValue) ?: defaultValue
    }

    fun getInt(key: String, defaultValue: Int = 0): Int {
        return properties?.getProperty(key)?.toIntOrNull() ?: defaultValue
    }

    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return properties?.getProperty(key)?.toBooleanStrictOrNull() ?: defaultValue
    }
}