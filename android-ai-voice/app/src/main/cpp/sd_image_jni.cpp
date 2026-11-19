#include <jni.h>
#include <android/log.h>
#include "stable-diffusion.h"

#include <algorithm>
#include <mutex>
#include <string>
#include <vector>
#include <chrono>

#define LOG_TAG "WorklyLocalImage"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace {
std::mutex g_mutex;
sd_ctx_t* g_context = nullptr;
std::string g_model_path;

bool ensure_context(const std::string& model_path) {
    if (g_context && g_model_path == model_path) return true;
    if (g_context) {
        free_sd_ctx(g_context);
        g_context = nullptr;
        g_model_path.clear();
    }

    sd_ctx_params_t params;
    sd_ctx_params_init(&params);
    params.model_path = model_path.c_str();
    params.n_threads = std::max(2, std::min(4, sd_get_num_physical_cores()));
    params.wtype = SD_TYPE_Q4_0;
    params.enable_mmap = true;
    params.auto_fit = true;

    LOGI("Loading local SD 1.5 model on CPU (%d threads)", params.n_threads);
    g_context = new_sd_ctx(&params);
    if (!g_context || !sd_ctx_supports_image_generation(g_context)) {
        if (g_context) free_sd_ctx(g_context);
        g_context = nullptr;
        LOGE("Could not initialize the local image model");
        return false;
    }
    g_model_path = model_path;
    return true;
}

std::string from_jstring(JNIEnv* env, jstring value) {
    if (!value) return {};
    const char* chars = env->GetStringUTFChars(value, nullptr);
    if (!chars) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
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

    sd_img_gen_params_t params;
    sd_img_gen_params_init(&params);
    params.prompt = prompt.c_str();
    params.width = width;
    params.height = height;
    params.batch_count = 1;
    params.seed = static_cast<int64_t>(
        std::chrono::high_resolution_clock::now().time_since_epoch().count() & 0x7fffffffffffffffLL
    );
    params.sample_params.sample_steps = std::max(4, std::min(10, static_cast<int>(steps)));
    params.sample_params.sample_method = EULER_A_SAMPLE_METHOD;
    params.sample_params.scheduler = KARRAS_SCHEDULER;
    params.sample_params.guidance.txt_cfg = 7.0f;

    sd_image_t* images = nullptr;
    int image_count = 0;
    LOGI("Starting local image generation: %dx%d, %d steps", width, height, params.sample_params.sample_steps);
    const bool ok = generate_image(g_context, &params, &images, &image_count);
    if (!ok || !images || image_count < 1 || !images[0].data) {
        if (images) free_sd_images(images, image_count);
        LOGE("Local image generation failed");
        return nullptr;
    }

    const sd_image_t& image = images[0];
    const size_t byte_count = static_cast<size_t>(image.width) * image.height * image.channel;
    if (image.width == 0 || image.height == 0 || image.channel < 3 || image.channel > 4 || byte_count > 4 * 1024 * 1024) {
        free_sd_images(images, image_count);
        LOGE("Generated image dimensions are invalid");
        return nullptr;
    }

    jint out_dims[3] = {
        static_cast<jint>(image.width),
        static_cast<jint>(image.height),
        static_cast<jint>(image.channel)
    };
    env->SetIntArrayRegion(dimensions, 0, 3, out_dims);
    jbyteArray output = env->NewByteArray(static_cast<jsize>(byte_count));
    if (output) {
        env->SetByteArrayRegion(output, 0, static_cast<jsize>(byte_count), reinterpret_cast<const jbyte*>(image.data));
    }
    free_sd_images(images, image_count);
    LOGI("Local image generation finished");
    return output;
}
