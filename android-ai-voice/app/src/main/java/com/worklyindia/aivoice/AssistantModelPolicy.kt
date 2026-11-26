package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
import android.os.StatFs
import java.io.File

/**
 * Conservative device capability policy for selecting a local assistant brain.
 *
 * This class recommends a model only. It never downloads, activates, or loads
 * weights. A model must also pass its own checksum and inference smoke test
 * before it can be marked READY.
 */
object AssistantModelPolicy {
    data class Candidate(
        val id: String,
        val displayName: String,
        val expectedBytes: Long,
        val minimumAvailableRamBytes: Long,
        val minimumFreeStorageBytes: Long,
        val enabled: Boolean = false
    )

    data class DeviceBudget(
        val availableRamBytes: Long,
        val freeStorageBytes: Long,
        val lowMemory: Boolean
    )

    data class Recommendation(
        val candidate: Candidate?,
        val reason: String,
        val budget: DeviceBudget
    )

    /**
     * Read current available memory and app-volume free space. Physical RAM is
     * deliberately not used as a proxy for available memory.
     */
    fun readBudget(context: Context, modelDirectory: File): DeviceBudget {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memory = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memory)
        val storagePath = if (modelDirectory.exists()) modelDirectory else modelDirectory.parentFile
            ?: context.filesDir
        val storage = StatFs(storagePath.absolutePath)
        return DeviceBudget(
            availableRamBytes = memory.availMem.coerceAtLeast(0L),
            freeStorageBytes = storage.availableBytes.coerceAtLeast(0L),
            lowMemory = memory.lowMemory
        )
    }

    /**
     * Choose the largest enabled candidate that fits the current runtime
     * budget, reserving additional RAM for Android, STT, TTS and the UI.
     */
    fun recommend(
        candidates: List<Candidate>,
        budget: DeviceBudget,
        reserveRamBytes: Long = 1_200L * 1024L * 1024L,
        reserveStorageBytes: Long = 512L * 1024L * 1024L
    ): Recommendation {
        val usableRam = (budget.availableRamBytes - reserveRamBytes).coerceAtLeast(0L)
        val usableStorage = (budget.freeStorageBytes - reserveStorageBytes).coerceAtLeast(0L)
        if (budget.lowMemory) {
            return Recommendation(null, "Android reports low memory. Close other apps and retry.", budget)
        }
        val candidate = candidates
            .asSequence()
            .filter { it.enabled }
            .filter { it.minimumAvailableRamBytes <= usableRam }
            .filter { it.minimumFreeStorageBytes <= usableStorage }
            .maxByOrNull { it.expectedBytes }
        val reason = when {
            candidate != null -> "Recommended from current available RAM and storage. Run the model smoke test before activation."
            candidates.none { it.enabled } -> "No verified compatible model is enabled in the catalog yet."
            usableStorage <= 0L -> "Not enough free storage after safety reserve."
            else -> "No enabled model fits current available RAM and storage. Use a smaller verified model or free resources."
        }
        return Recommendation(candidate, reason, budget)
    }
}
