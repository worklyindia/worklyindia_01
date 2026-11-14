package com.worklyindia.app

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "offline_public_jobs")
data class OfflinePublicJobEntity(
    @PrimaryKey val id: String,
    val title: String,
    val company: String,
    val location: String,
    val salary: String,
    val jobType: String,
    val experience: String,
    val category: String,
    val description: String,
    val requirements: String
)

@Dao
interface OfflinePublicJobsDao {
    @Query("SELECT * FROM offline_public_jobs ORDER BY title COLLATE NOCASE")
    fun getAll(): List<OfflinePublicJobEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertAll(rows: List<OfflinePublicJobEntity>)

    @Query("DELETE FROM offline_public_jobs")
    fun clear()

    @androidx.room.Transaction
    fun replaceAll(rows: List<OfflinePublicJobEntity>) {
        clear()
        insertAll(rows)
    }
}

@Database(entities = [OfflinePublicJobEntity::class], version = 1, exportSchema = false)
abstract class OfflineJobsDatabase : RoomDatabase() {
    abstract fun publicJobsDao(): OfflinePublicJobsDao

    companion object {
        @Volatile private var INSTANCE: OfflineJobsDatabase? = null

        fun getInstance(context: Context): OfflineJobsDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    OfflineJobsDatabase::class.java,
                    "workly_offline_jobs.db"
                ).build().also { INSTANCE = it }
            }
    }
}
