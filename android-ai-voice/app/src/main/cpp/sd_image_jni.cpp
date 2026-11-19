#include <jni.h>
#include <android/log.h>
#include "stable-diffusion.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <mutex>
#include <string>

#define LOG_TAG "WorklyLocalImage"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace {
std::mutex g_mutex;
sd_ctx_t* g_context = nullptr;
std::string g_model_path;

std::string from_jstring(JNIEnv* env, jstring value) {
    if (!value) return {};
    const char* chars = env->GetStringUTFChars(value, nullptr);
    if (!chars) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

bool set_string(sd_opt_t* options, const char* key, const std::string& value) {
    const sd_status_t status = sd_opt_set_string(options, key, value.c_str());
    if (status == SD_STATUS_OK) return true;
    LOGE("Could not set %s: %s", key, sd_get_last_error());
    return false;
}

bool set_int(sd_opt_t* options, const char* key, int64_t value) {
    const sd_status_t status = sd_opt_set_int(options, key, value);
    if (status == SD_STATUS_OK) return true;
    LOGE("Could not set %s: %s", key, sd_get_last_error());
    return false;
}

bool ensure_context(const std::string& model_path) {
    if (g_context && g_model_path == model_path) return true;
    if (g_context) {
        sd_ctx_free(g_context);
        g_context = nullptr;
        g_model_path.clear();
    }

    sd_ctx_opt_t* options = sd_ctx_opt_create();
    if (!options) {
        LOGE("Could not allocate local image context options");
        return false;
    }

    const int threads = std::max(2, std::min(4, sd_get_num_physical_cores()));
    bool configured =
        set_string(options, "model_path", model_path) &&
        set_int(options, "n_threads", threads) &&
        sd_opt_set_bool(options, "enable_mmap", true) == SD_STATUS_OK &&
        sd_opt_set_bool(options, "auto_fit", true) == SD_STATUS_OK &&
        set_string(options, "backend", "cpu");

    if (!configured) {
        LOGE("Could not configure local Stable Diffusion context: %s", sd_get_last_error());
        sd_opt_free(options);
        return false;
    }

    LOGI("Loading local SD 1.5 model on CPU (%d threads)", threads);
    const sd_status_t status = sd_ctx_create(options, &g_context);
    sd_opt_free(options);
    if (status != SD_STATUS_OK || !g_context || !sd_ctx_supports_image_generation(g_context)) {
        LOGE("Could not initialize local image model: %s", sd_get_last_error());
        if (g_context) sd_ctx_free(g_context);
        g_context = nullptr;
        return false;
    }
    g_model_path = model_path;
    return true;
}
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_worklyindia_aivoice_LocalImageGenerator_nativeGenerate(
    JNIEnv* env,
    jclass,
    jstring modelPathValue,
    jstring promptValue,
    jint width,
    jint height,
    jint steps,
    jintArray dimensions
) {
    const std::string model_path = from_jstring(env, modelPathValue);
    const std::string prompt = from_jstring(env, promptValue);
    if (model_path.empty() || prompt.empty() || !dimensions || width != 512 || height != 512) {
        LOGE("Invalid local image generation arguments");
        return nullptr;
    }

    std::lock_guard<std::mutex> lock(g_mutex);
    if (!ensure_context(model_path)) return nullptr;

    sd_img_gen_opt_t* options = sd_img_gen_opt_create();
    if (!options) {
        LOGE("Could not allocate image generation options");
        return nullptr;
    }

    const int64_t seed = static_cast<int64_t>(
        std::chrono::high_resolution_clock::now().time_since_epoch().count() & 0x7fffffffffffffffLL
    );
    bool configured =
        set_string(options, "prompt", prompt) &&
        set_int(options, "width", width) &&
        set_int(options, "height", height) &&
        set_int(options, "seed", seed) &&
        set_int(options, "batch_count", 1) &&
        set_int(options, "sample.steps", std::max(4, std::min(10, static_cast<int>(steps)))) &&
        sd_opt_set_float(options, "sample.guidance.txt_cfg", 7.0) == SD_STATUS_OK;
    if (!configured) {
        LOGE("Could not configure image generation: %s", sd_get_last_error());
        sd_opt_free(options);
        return nullptr;
    }

    sd_result_t* result = nullptr;
    LOGI("Starting local image generation: %dx%d, %d steps", width, height, std::max(4, std::min(10, static_cast<int>(steps))));
    const sd_status_t status = sd_generate_image(g_context, options, &result);
    sd_opt_free(options);
    if (status != SD_STATUS_OK || !result) {
        LOGE("Local image generation failed: %s", sd_get_last_error());
        if (result) sd_result_free(result);
        return nullptr;
    }

    if (sd_result_get_image_count(result) < 1) {
        LOGE("Stable Diffusion returned no image");
        sd_result_free(result);
        return nullptr;
    }

    const sd_tensor_t* image = sd_result_get_image(result, 0);
    if (!image) {
        LOGE("Stable Diffusion returned an empty image tensor");
        sd_result_free(result);
        return nullptr;
    }
    const int64_t channels = sd_tensor_dim(image, 0);
    const int64_t out_width = sd_tensor_dim(image, 1);
    const int64_t out_height = sd_tensor_dim(image, 2);
    const size_t byte_count = sd_tensor_byte_size(image);
    const uint8_t* pixels = static_cast<const uint8_t*>(sd_tensor_data(image));
    const size_t expected = static_cast<size_t>(channels * out_width * out_height);
    if (!pixels || out_width <= 0 || out_height <= 0 || (channels != 3 && channels != 4) ||
        expected != byte_count || byte_count > 4 * 1024 * 1024) {
        LOGE("Generated image tensor has invalid dimensions");
        sd_result_free(result);
        return nullptr;
    }

    jint out_dims[3] = {
        static_cast<jint>(out_width),
        static_cast<jint>(out_height),
        static_cast<jint>(channels)
    };
    env->SetIntArrayRegion(dimensions, 0, 3, out_dims);
    jbyteArray output = env->NewByteArray(static_cast<jsize>(byte_count));
    if (output) {
        env->SetByteArrayRegion(output, 0, static_cast<jsize>(byte_count), reinterpret_cast<const jbyte*>(pixels));
    }
    sd_result_free(result);
    LOGI("Local image generation finished");
    return output;
}
