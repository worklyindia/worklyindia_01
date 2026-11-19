cmake_minimum_required(VERSION 3.22.1)
project(workly_offline_ai LANGUAGES C CXX)

include(FetchContent)
include(ExternalProject)

# Keep the existing on-device language model runtime unchanged.
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
    llama_cpp
    GIT_REPOSITORY https://github.com/ggml-org/llama.cpp.git
    GIT_TAG b5046
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(llama_cpp)

add_library(worklyllama SHARED offline_llama_jni.cpp)
target_compile_features(worklyllama PRIVATE cxx_std_17)
target_link_libraries(worklyllama PRIVATE llama log android)

# Build stable-diffusion.cpp as an isolated CMake project. It has its own GGML
# revision, so it must not share the older GGML targets used by llama.cpp above.
# The Android build uses the CPU backend for broad Mali/Adreno compatibility.
set(SDCPP_SOURCE_DIR "${CMAKE_BINARY_DIR}/workly-sdcpp-src")
set(SDCPP_BINARY_DIR "${CMAKE_BINARY_DIR}/workly-sdcpp-build")
set(SDCPP_INSTALL_DIR "${CMAKE_BINARY_DIR}/workly-sdcpp-install")

ExternalProject_Add(workly_sdcpp_external
    GIT_REPOSITORY https://github.com/leejet/stable-diffusion.cpp.git
    GIT_TAG 532d2c15c430a785a712b2d94281f04e733008a4
    GIT_SHALLOW FALSE
    GIT_SUBMODULES_RECURSE TRUE
    SOURCE_DIR "${SDCPP_SOURCE_DIR}"
    BINARY_DIR "${SDCPP_BINARY_DIR}"
    INSTALL_DIR "${SDCPP_INSTALL_DIR}"
    CMAKE_ARGS
        -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE}
        -DANDROID_ABI=${ANDROID_ABI}
        -DANDROID_PLATFORM=${ANDROID_PLATFORM}
        -DANDROID_NDK=${ANDROID_NDK}
        -DANDROID_STL=c++_shared
        -DCMAKE_BUILD_TYPE=Release
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON
        -DCMAKE_INSTALL_PREFIX=${SDCPP_INSTALL_DIR}
        -DCMAKE_INSTALL_LIBDIR=lib
        -DCMAKE_INSTALL_INCLUDEDIR=include
        -DSD_BUILD_EXAMPLES=OFF
        -DSD_BUILD_SHARED_LIBS=ON
        -DSD_BUILD_SHARED_GGML_LIB=OFF
        -DSD_WEBP=OFF
        -DSD_WEBM=OFF
        -DGGML_NATIVE=OFF
        -DGGML_OPENMP=OFF
        -DGGML_LLAMAFILE=OFF
        -DGGML_OPENCL=OFF
        -DGGML_VULKAN=OFF
        -DGGML_METAL=OFF
        -DGGML_CUDA=OFF
    BUILD_COMMAND ${CMAKE_COMMAND} --build <BINARY_DIR> --config Release --parallel 2
    INSTALL_COMMAND ${CMAKE_COMMAND} --install <BINARY_DIR> --prefix ${SDCPP_INSTALL_DIR}
    BUILD_BYPRODUCTS "${SDCPP_INSTALL_DIR}/lib/libstable-diffusion.so"
    LOG_CONFIGURE ON
    LOG_BUILD ON
)

add_library(workly_stable_diffusion SHARED IMPORTED GLOBAL)
set_target_properties(workly_stable_diffusion PROPERTIES
    IMPORTED_LOCATION "${SDCPP_INSTALL_DIR}/lib/libstable-diffusion.so"
    INTERFACE_INCLUDE_DIRECTORIES "${SDCPP_SOURCE_DIR}/include"
)

add_library(worklysd SHARED sd_image_jni.cpp)
target_compile_features(worklysd PRIVATE cxx_std_17)
target_include_directories(worklysd PRIVATE "${SDCPP_SOURCE_DIR}/include")
target_link_libraries(worklysd PRIVATE workly_stable_diffusion log android)
add_dependencies(worklysd workly_sdcpp_external)
