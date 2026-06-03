package com.example.mykeyboard

import android.app.Application
import com.example.mykeyboard.personal.JarvisBrainRuntime

class AritenisApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        JarvisBrainRuntime.initialize(this)
    }
}
