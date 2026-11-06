package com.worklyindia.app

import android.app.Application
import live.videosdk.rtc.android.VideoSDK

class WorklyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        VideoSDK.initialize(applicationContext)
    }
}
