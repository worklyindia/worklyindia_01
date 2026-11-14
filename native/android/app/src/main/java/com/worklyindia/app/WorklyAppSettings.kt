package com.worklyindia.app

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.worklySettingsDataStore by preferencesDataStore(name = "workly_app_settings")

/** Small, non-sensitive app settings and offline-sync metadata. Never store tokens here. */
object WorklyAppSettings {
    private val LAST_PUBLIC_JOBS_SYNC = longPreferencesKey("last_public_jobs_sync_at")
    private val OFFLINE_PUBLIC_JOBS_ENABLED = booleanPreferencesKey("offline_public_jobs_enabled")

    fun lastPublicJobsSyncAt(context: Context): Long = runCatching {
        runBlocking {
            context.applicationContext.worklySettingsDataStore.data.first()[LAST_PUBLIC_JOBS_SYNC] ?: 0L
        }
    }.getOrDefault(0L)

    fun setLastPublicJobsSyncAt(context: Context, timestamp: Long) {
        runCatching {
            runBlocking {
                context.applicationContext.worklySettingsDataStore.edit {
                    it[LAST_PUBLIC_JOBS_SYNC] = timestamp
                    it[OFFLINE_PUBLIC_JOBS_ENABLED] = true
                }
            }
        }.onFailure { error ->
            android.util.Log.w("WorklyAppSettings", "Could not persist offline sync metadata", error)
        }
    }

    fun isOfflinePublicJobsEnabled(context: Context): Boolean = runCatching {
        runBlocking {
            context.applicationContext.worklySettingsDataStore.data.first()[OFFLINE_PUBLIC_JOBS_ENABLED] ?: true
        }
    }.getOrDefault(true)
}
