package com.worklyindia.aivoice

import android.app.ActivityManager
import android.content.Context
import android.graphics.Bitmap

/** JNI bridge to stable-diffusion.cpp; all image inference runs on the Android device. */
object LocalImageGenerator {
    init {
        System.loadLibrary("worklysd")
    }

    @JvmStatic
    private external fun nativeGenerate(
        modelPath: String,
        prompt: String,
        width: Int,
        height: Int,
        steps: Int,
        dimensions: IntArray
    ): ByteArray?

    fun generateBitmap(
        context: Context,
        prompt: String,
        width: Int = 512,
        height: Int = 512,
        steps: Int = 8
    ): Bitmap {
        require(prompt.isNotBlank()) { "Describe the image you want to create." }
        require(width == 512 && height == 512) { "This phone profile currently supports 512 × 512 images." }
        require(ImageModelManager.isModelReady(context)) { "Download the local image model before generating." }

        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memory = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memory)
        if (memory.lowMemory || memory.availMem < 1_500_000_000L) {
            throw IllegalStateException("Phone memory is low. Close other apps and try again.")
        }

        val dimensions = IntArray(3)
        val rgb = nativeGenerate(
            ImageModelManager.modelFile(context).absolutePath,
            prompt.trim().take(4000),
            width,
            height,
            steps.coerceIn(4, 10),
            dimensions
        ) ?: throw IllegalStateException("The local image engine could not generate an image. Check free RAM and model files.")

        val outWidth = dimensions.getOrNull(0) ?: 0
        val outHeight = dimensions.getOrNull(1) ?: 0
        val channels = dimensions.getOrNull(2) ?: 0
        require(outWidth > 0 && outHeight > 0 && channels in 3..4 && rgb.size == outWidth * outHeight * channels) {
            "Local image engine returned invalid image data."
        }
        val pixels = IntArray(outWidth * outHeight)
        var source = 0
        for (index in pixels.indices) {
            val red = rgb[source++].toInt() and 0xff
            val green = rgb[source++].toInt() and 0xff
            val blue = rgb[source++].toInt() and 0xff
            if (channels == 4) source++
            pixels[index] = (0xff shl 24) or (red shl 16) or (green shl 8) or blue
        }
        return Bitmap.createBitmap(pixels, outWidth, outHeight, Bitmap.Config.ARGB_8888)
    }
}
