import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const propertiesPath = resolve("android-release.properties");
const gradlePath = resolve("native/android/app/build.gradle.kts");
let versionCode = 7;
let versionName = "2.4.1";
let minSupportedVersionCode = 1;
let releaseNotes = "Performance improvements and bug fixes.";
let generatedFrom = "checked-in-fallback";

try {
  const properties = await readFile(propertiesPath, "utf8");
  const values = Object.fromEntries(properties.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#")).map(line => {
    const index = line.indexOf("=");
    return index < 0 ? [line, ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  const parsedCode = Number(values.versionCode);
  if (Number.isInteger(parsedCode) && parsedCode > 0 && values.versionName) {
    versionCode = parsedCode;
    versionName = values.versionName;
    minSupportedVersionCode = Number(values.minSupportedVersionCode) || 1;
    releaseNotes = values.releaseNotes || releaseNotes;
    generatedFrom = "android-release.properties";
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  try {
    const gradle = await readFile(gradlePath, "utf8");
    const parsedCode = Number(gradle.match(/versionCode\s*=\s*(\d+)/)?.[1]);
    const parsedName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
    if (Number.isInteger(parsedCode) && parsedCode > 0 && parsedName) {
      versionCode = parsedCode;
      versionName = parsedName;
      generatedFrom = "native/android/app/build.gradle.kts";
    }
  } catch (gradleError) {
    if (gradleError?.code !== "ENOENT") throw gradleError;
    console.warn("Android metadata source unavailable; using checked-in fallback.");
  }
}

const metadata = {
  version_name: versionName,
  version_code: versionCode,
  min_supported_version_code: minSupportedVersionCode,
  release_notes: releaseNotes,
  application_id: "com.worklyindia.app",
  generated_from: generatedFrom
};

await mkdir(resolve("public"), { recursive: true });
await writeFile(resolve("public/android-app-build-info.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log("Generated Android release metadata:", versionName, "(" + versionCode + ")");
