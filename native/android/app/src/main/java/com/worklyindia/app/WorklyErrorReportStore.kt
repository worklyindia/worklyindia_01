package com.worklyindia.app

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** Private SQLite outbox. Reports are removed only after a 2xx Supabase response. */
object WorklyErrorReportStore {
    private const val DB_NAME = "workly_error_outbox.db"
    private const val TABLE = "pending_reports"
    private const val MAX_PENDING = 1000

    private class Helper(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("CREATE TABLE $TABLE (event_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)")
            db.execSQL("CREATE INDEX pending_reports_created_idx ON $TABLE(created_at)")
        }
        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }

    @Synchronized
    fun enqueue(context: Context, eventId: String, payload: String) {
        val db = Helper(context.applicationContext).writableDatabase
        val now = System.currentTimeMillis()
        db.beginTransaction()
        try {
            db.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { cursor ->
                if (cursor.moveToFirst() && cursor.getInt(0) >= MAX_PENDING) return
            }
            db.execSQL("INSERT OR IGNORE INTO $TABLE(event_id,payload,created_at) VALUES(?,?,?)", arrayOf(eventId, payload, now))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    @Synchronized
    fun pending(context: Context, limit: Int = 20): List<Pair<String, String>> {
        val db = Helper(context.applicationContext).readableDatabase
        val output = mutableListOf<Pair<String, String>>()
        db.rawQuery("SELECT event_id,payload FROM $TABLE ORDER BY created_at ASC LIMIT ?", arrayOf(limit.coerceIn(1, 25).toString())).use { cursor ->
            while (cursor.moveToNext()) output += cursor.getString(0) to cursor.getString(1)
        }
        return output
    }

    @Synchronized
    fun acknowledge(context: Context, eventIds: List<String>) {
        if (eventIds.isEmpty()) return
        val db = Helper(context.applicationContext).writableDatabase
        val placeholders = eventIds.joinToString(",") { "?" }
        db.delete(TABLE, "event_id IN ($placeholders)", eventIds.toTypedArray())
    }

    fun pendingCount(context: Context): Int {
        val db = Helper(context.applicationContext).readableDatabase
        db.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { return if (it.moveToFirst()) it.getInt(0) else 0 }
    }
}
