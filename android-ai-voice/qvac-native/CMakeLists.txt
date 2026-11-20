cmake_minimum_required(VERSION 3.22)
project(workly_qvac_tts_android LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT DEFINED QVAC_TTS_ROOT OR NOT EXISTS "${QVAC_TTS_ROOT}/CMakeLists.txt")
    message(FATAL_ERROR "QVAC_TTS_ROOT must point to the staged qvac-fabric-speech.cpp/engines/tts source.")
endif()

# Build the speech engine in its own CMake graph. This keeps its GGML target
# names isolated from the app's existing llama.cpp and Qwen3 builds.
set(TTS_CPP_USE_SYSTEM_GGML OFF CACHE BOOL "" FORCE)
set(TTS_CPP_BUILD_LIBRARY ON CACHE BOOL "" FORCE)
set(TTS_CPP_BUILD_SHARED ON CACHE BOOL "" FORCE)
set(TTS_CPP_BUILD_EXECUTABLES OFF CACHE BOOL "" FORCE)
set(TTS_CPP_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(TTS_CPP_INSTALL OFF CACHE BOOL "" FORCE)
set(TTS_CPP_CCACHE OFF CACHE BOOL "" FORCE)
set(TTS_CPP_COREML OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL OFF CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS OFF CACHE BOOL "" FORCE)
set(GGML_CPU_REPACK OFF CACHE BOOL "" FORCE)
add_subdirectory("${QVAC_TTS_ROOT}" qvac-tts)

add_library(workly_qvac_tts_jni SHARED qvac_tts_jni.cpp)
target_include_directories(workly_qvac_tts_jni PRIVATE "${QVAC_TTS_ROOT}/include")
target_link_libraries(workly_qvac_tts_jni PRIVATE tts-cpp log)
set_target_properties(workly_qvac_tts_jni PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/jni/arm64-v8a"
)
