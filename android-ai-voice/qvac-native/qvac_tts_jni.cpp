#include <jni.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

#include "tts-cpp/chatterbox/engine.h"
#include "tts-cpp/cosyvoice/engine.h"
#include "tts-cpp/parler/engine.h"

namespace fs = std::filesystem;

namespace {
enum EngineKind { CHATTERBOX = 0, COSYVOICE = 1, PARLER = 2 };

struct Instance {
    EngineKind kind;
    std::unique_ptr<tts_cpp::chatterbox::Engine> chatterbox;
    std::unique_ptr<tts_cpp::cosyvoice::Engine> cosyvoice;
    std::unique_ptr<tts_cpp::parler::Engine> parler;
};

std::string utf8(JNIEnv* env, jstring value) {
    if (!value) return {};
    const jsize length = env->GetStringLength(value);
    const jchar* chars = env->GetStringChars(value, nullptr);
    if (!chars) throw std::runtime_error("Could not read text input.");
    std::string out;
    out.reserve(static_cast<size_t>(length) * 3);
    for (jsize i = 0; i < length; ++i) {
        uint32_t cp = chars[i];
        if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < length) {
            const uint32_t low = chars[i + 1];
            if (low >= 0xDC00 && low <= 0xDFFF) {
                cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
                ++i;
            }
        }
        if (cp <= 0x7F) out.push_back(static_cast<char>(cp));
        else if (cp <= 0x7FF) {
            out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
            out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        } else if (cp <= 0xFFFF) {
            out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
            out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        } else {
            out.push_back(static_cast<char>(0xF0 | (cp >> 18)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
            out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
        }
    }
    env->ReleaseStringChars(value, chars);
    return out;
}

void put16(std::ofstream& f, uint16_t v) {
    const char b[2] = {static_cast<char>(v), static_cast<char>(v >> 8)};
    f.write(b, 2);
}
void put32(std::ofstream& f, uint32_t v) {
    const char b[4] = {static_cast<char>(v), static_cast<char>(v >> 8),
                       static_cast<char>(v >> 16), static_cast<char>(v >> 24)};
    f.write(b, 4);
}
void writeWav(const std::string& path, const std::vector<float>& pcm, int sampleRate) {
    if (pcm.empty()) throw std::runtime_error("TTS engine returned empty audio.");
    if (sampleRate < 8000 || sampleRate > 192000) throw std::runtime_error("TTS engine returned an invalid sample rate.");
    if (pcm.size() > (0xFFFFFFFFu - 44u) / 2u) throw std::runtime_error("Generated audio is too large for WAV.");
    const uint32_t dataBytes = static_cast<uint32_t>(pcm.size() * 2);
    fs::create_directories(fs::path(path).parent_path());
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    if (!out) throw std::runtime_error("Cannot create generated WAV file.");
    out.write("RIFF", 4); put32(out, 36 + dataBytes); out.write("WAVE", 4);
    out.write("fmt ", 4); put32(out, 16); put16(out, 1); put16(out, 1);
    put32(out, static_cast<uint32_t>(sampleRate)); put32(out, static_cast<uint32_t>(sampleRate * 2));
    put16(out, 2); put16(out, 16); out.write("data", 4); put32(out, dataBytes);
    for (float sample : pcm) {
        const float finite = std::isfinite(sample) ? sample : 0.0f;
        const float clamped = std::max(-1.0f, std::min(1.0f, finite));
        const int value = static_cast<int>(std::lrint(clamped * (clamped < 0 ? 32768.0f : 32767.0f)));
        put16(out, static_cast<uint16_t>(static_cast<int16_t>(value)));
    }
    out.flush();
    if (!out) throw std::runtime_error("Failed while writing generated WAV.");
}

void throwJava(JNIEnv* env, const std::string& message) {
    jclass type = env->FindClass("java/lang/IllegalStateException");
    if (type) env->ThrowNew(type, message.c_str());
}
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_worklyindia_aivoice_QvacTtsEngine_nativeCreate(
    JNIEnv* env, jclass, jint kind, jstring modelDir, jstring modelA, jstring modelB,
    jstring description, jstring referenceAudio, jstring referenceText, jint threads) {
    try {
        auto instance = std::make_unique<Instance>();
        instance->kind = static_cast<EngineKind>(kind);
        const std::string dir = utf8(env, modelDir);
        const std::string a = utf8(env, modelA);
        const std::string b = utf8(env, modelB);
        const std::string desc = utf8(env, description);
        const std::string refAudio = utf8(env, referenceAudio);
        const std::string refText = utf8(env, referenceText);
        const int nThreads = std::max(1, std::min(4, static_cast<int>(threads)));

        if (kind == CHATTERBOX) {
            tts_cpp::chatterbox::EngineOptions opts;
            opts.t3_gguf_path = a;
            opts.s3gen_gguf_path = b;
            opts.n_threads = nThreads;
            opts.n_predict = 512;
            opts.n_gpu_layers = 0;
            instance->chatterbox = std::make_unique<tts_cpp::chatterbox::Engine>(opts);
        } else if (kind == COSYVOICE) {
            tts_cpp::cosyvoice::EngineOptions opts;
            opts.model_dir = dir;
            opts.vocab_path = a;
            opts.merges_path = b;
            opts.reference_audio = refAudio;
            opts.prompt_text = refText;
            opts.n_threads = nThreads;
            opts.n_gpu_layers = 0;
            instance->cosyvoice = std::make_unique<tts_cpp::cosyvoice::Engine>(opts);
        } else if (kind == PARLER) {
            tts_cpp::parler::EngineOptions opts;
            opts.model_gguf_path = a;
            opts.default_description = desc.empty()
                ? "A clear, natural Indian English speaker with a warm, friendly tone."
                : desc;
            opts.n_threads = nThreads;
            opts.n_gpu_layers = 0;
            opts.max_frames = 1200;
            instance->parler = std::make_unique<tts_cpp::parler::Engine>(opts);
        } else {
            throw std::runtime_error("Unsupported native TTS engine.");
        }
        return reinterpret_cast<jlong>(instance.release());
    } catch (const std::exception& e) {
        throwJava(env, e.what());
    } catch (...) {
        throwJava(env, "Unknown native TTS initialization error.");
    }
    return 0;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_worklyindia_aivoice_QvacTtsEngine_nativeSynthesize(
    JNIEnv* env, jclass, jlong handle, jstring text, jstring outputPath) {
    try {
        auto* instance = reinterpret_cast<Instance*>(handle);
        if (!instance) throw std::runtime_error("Native TTS engine is not loaded.");
        const std::string input = utf8(env, text);
        const std::string path = utf8(env, outputPath);
        if (input.empty()) throw std::runtime_error("Enter text to synthesize.");
        if (path.empty()) throw std::runtime_error("Output WAV path is missing.");

        if (instance->kind == CHATTERBOX) {
            auto result = instance->chatterbox->synthesize(input);
            writeWav(path, result.pcm, result.sample_rate);
            return result.sample_rate;
        }
        if (instance->kind == COSYVOICE) {
            auto result = instance->cosyvoice->synthesize(input);
            writeWav(path, result.pcm, result.sample_rate);
            return result.sample_rate;
        }
        auto result = instance->parler->synthesize(input);
        writeWav(path, result.pcm, result.sample_rate);
        return result.sample_rate;
    } catch (const std::exception& e) {
        throwJava(env, e.what());
    } catch (...) {
        throwJava(env, "Unknown native TTS synthesis error.");
    }
    return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_com_worklyindia_aivoice_QvacTtsEngine_nativeDestroy(JNIEnv*, jclass, jlong handle) {
    delete reinterpret_cast<Instance*>(handle);
}
