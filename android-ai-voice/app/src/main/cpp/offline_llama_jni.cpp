#include <jni.h>
#include <android/log.h>
#include <llama.h>

#include <algorithm>
#include <mutex>
#include <string>
#include <vector>
#include <cstdint>
#include <thread>

#define LOG_TAG "WorklyOfflineAI"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {
std::mutex engine_mutex;
llama_model * model = nullptr;

void unload_model_locked() {
    if (model != nullptr) {
        llama_model_free(model);
        model = nullptr;
    }
}

std::string from_java(JNIEnv * env, jstring value) {
    if (value == nullptr) return {};
    const char * chars = env->GetStringUTFChars(value, nullptr);
    if (chars == nullptr) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

// Convert ordinary UTF-8 model output to UTF-16 safely before calling Java.
// This keeps Hindi/Gujarati characters intact even when a token ends mid-word.
jstring to_java_string(JNIEnv * env, const std::string & value) {
    std::vector<jchar> utf16;
    for (size_t i = 0; i < value.size();) {
        const unsigned char lead = static_cast<unsigned char>(value[i]);
        uint32_t cp = 0;
        size_t count = 0;
        if (lead < 0x80) { cp = lead; count = 1; }
        else if ((lead & 0xE0) == 0xC0) { cp = lead & 0x1F; count = 2; }
        else if ((lead & 0xF0) == 0xE0) { cp = lead & 0x0F; count = 3; }
        else if ((lead & 0xF8) == 0xF0) { cp = lead & 0x07; count = 4; }
        else { utf16.push_back(0xFFFD); ++i; continue; }
        if (i + count > value.size()) { utf16.push_back(0xFFFD); break; }
        bool valid = true;
        for (size_t j = 1; j < count; ++j) {
            const unsigned char next = static_cast<unsigned char>(value[i + j]);
            if ((next & 0xC0) != 0x80) { valid = false; break; }
            cp = (cp << 6) | (next & 0x3F);
        }
        if (!valid || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) {
            utf16.push_back(0xFFFD); ++i; continue;
        }
        if (cp <= 0xFFFF) utf16.push_back(static_cast<jchar>(cp));
        else {
            cp -= 0x10000;
            utf16.push_back(static_cast<jchar>(0xD800 + (cp >> 10)));
            utf16.push_back(static_cast<jchar>(0xDC00 + (cp & 0x3FF)));
        }
        i += count;
    }
    return env->NewString(utf16.data(), static_cast<jsize>(utf16.size()));
}
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_worklyindia_aivoice_OfflineAiEngine_nativeLoadModel(
        JNIEnv * env, jobject, jstring model_path) {
    const std::string path = from_java(env, model_path);
    if (path.empty()) return JNI_FALSE;

    std::lock_guard<std::mutex> lock(engine_mutex);
    unload_model_locked();
    llama_backend_init();

    llama_model_params params = llama_model_default_params();
    params.use_mmap = true;
    params.use_mlock = false;
    model = llama_model_load_from_file(path.c_str(), params);
    if (model == nullptr) {
        LOGE("Unable to load GGUF model: %s", path.c_str());
        return JNI_FALSE;
    }
    return JNI_TRUE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_worklyindia_aivoice_OfflineAiEngine_nativeGenerate(
        JNIEnv * env, jobject thiz, jstring user_prompt, jint max_tokens) {
    const std::string question = from_java(env, user_prompt);
    if (question.empty()) return env->NewStringUTF("Please enter a message.");

    std::lock_guard<std::mutex> lock(engine_mutex);
    if (model == nullptr) return env->NewStringUTF("Offline AI model is not loaded.");

    // Qwen2.5 uses the ChatML conversation format.
    const std::string prompt =
        "<|im_start|>system\n"
        "You are Workly AI, a helpful offline assistant. Answer the user's latest message directly. "
        "Use the previous conversation as context, remember details already provided, and do not ask for information the user already gave. "
        "Stay on the exact topic and follow the user's language. Give a useful, specific answer, not a generic greeting. "
        "Keep simple answers concise; explain more only when the question needs it. If unsure, say so honestly.\n"
        "<|im_end|>\n<|im_start|>user\n" + question +
        "\n<|im_end|>\n<|im_start|>assistant\n";

    const llama_vocab * vocab = llama_model_get_vocab(model);
    const int required = -llama_tokenize(
        vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
        nullptr, 0, true, true);
    if (required <= 0 || required > 1800) {
        return env->NewStringUTF("Message is too long for the offline model. Please shorten it.");
    }

    std::vector<llama_token> tokens(static_cast<size_t>(required));
    const int token_count = llama_tokenize(
        vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()),
        tokens.data(), static_cast<int32_t>(tokens.size()), true, true);
    if (token_count < 0) return env->NewStringUTF("Could not prepare the message for the model.");

    llama_context_params context_params = llama_context_default_params();
    context_params.n_ctx = 2048;
    context_params.n_batch = std::max(1, token_count);
    const unsigned int cpu_count = std::thread::hardware_concurrency();
    const int worker_threads = std::clamp(static_cast<int>(cpu_count == 0 ? 4 : cpu_count), 2, 6);
    context_params.n_threads = worker_threads;
    context_params.n_threads_batch = worker_threads;
    llama_context * context = llama_init_from_model(model, context_params);
    if (context == nullptr) return env->NewStringUTF("Not enough memory to start offline AI on this phone.");

    struct llama_sampler_chain_params sampler_params = llama_sampler_chain_default_params();
    llama_sampler * sampler = llama_sampler_chain_init(sampler_params);
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    llama_batch batch = llama_batch_get_one(tokens.data(), token_count);
    std::string output;
    jclass engine_class = env->GetObjectClass(thiz);
    jmethodID token_callback = engine_class == nullptr ? nullptr :
        env->GetMethodID(engine_class, "onNativeToken", "(Ljava/lang/String;)V");
    const int limit = std::clamp(static_cast<int>(max_tokens), 16, 256);

    if (llama_decode(context, batch) != 0) {
        llama_sampler_free(sampler);
        llama_free(context);
        return env->NewStringUTF("The model could not process this message. Try a shorter question.");
    }

    for (int i = 0; i < limit; ++i) {
        llama_token next = llama_sampler_sample(sampler, context, -1);
        if (llama_vocab_is_eog(vocab, next)) break;

        char piece[512];
        const int piece_size = llama_token_to_piece(vocab, next, piece, sizeof(piece), 0, true);
        if (piece_size > 0) {
            output.append(piece, static_cast<size_t>(piece_size));
            if (token_callback != nullptr) {
                jstring partial = to_java_string(env, output);
                if (partial != nullptr) {
                    env->CallVoidMethod(thiz, token_callback, partial);
                    env->DeleteLocalRef(partial);
                    if (env->ExceptionCheck()) env->ExceptionClear();
                }
            }
        }

        batch = llama_batch_get_one(&next, 1);
        if (llama_decode(context, batch) != 0) break;
    }

    llama_sampler_free(sampler);
    llama_free(context);
    if (output.empty()) output = "I could not generate a response. Please try again.";
    return env->NewStringUTF(output.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_worklyindia_aivoice_OfflineAiEngine_nativeUnloadModel(JNIEnv *, jobject) {
    std::lock_guard<std::mutex> lock(engine_mutex);
    unload_model_locked();
}
