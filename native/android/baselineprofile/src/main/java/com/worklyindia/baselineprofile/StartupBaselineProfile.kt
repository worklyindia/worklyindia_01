package com.worklyindia.baselineprofile

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartupBaselineProfile {
    @get:Rule
    val baselineProfileRule = BaselineProfileRule()

    @Test
    fun generateStartupProfile() = baselineProfileRule.collect(
        packageName = "com.worklyindia.app",
        includeInStartupProfile = true
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg("com.worklyindia.app")), 10_000)
    }
}
