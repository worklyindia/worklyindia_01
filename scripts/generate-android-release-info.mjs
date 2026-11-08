import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const gradlePath = resolve("native/android/app/build.gradle.kts");
let versionCode = 7;
let versionName = "2.4.1";
let generatedFrom = "web-build-fallback";

try {
  const gradle = await readFile(gradlePath, "utf8");
  const parsedCode = Number(gradle.match(/versionCode\\s*=\\s*(\\d+)/)?.[1]);
  const parsedName = gradle.match(/versionName\\s*=\\s*"([^"]+)"/)?.[1];
  if (Number.isInteger(parsedCode) && parsedCode > 0 && parsedName) {
    versionCode = parsedCode;
    versionName = parsedName;
    generatedFrom = "native/android/app/build.gradle.kts";
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.warn("Android Gradle file is excluded from this web deployment; using the checked-in release fallback.");
}

const metadata = {
  version_name: versionName,
  version_code: versionCode,
  min_supported_version_code: 1,
  release_notes: "Performance improvements and bug fixes.",
  application_id: "com.worklyindia.app",
  generated_from: generatedFrom
};

await mkdir(resolve("public"), { recursive: true });
await writeFile(resolve("public/android-app-build-info.json"), JSON.stringify(metadata, null, 2) + "\\n");
console.log("Generated Android release metadata:", versionName, "(" + versionCode + ")");
