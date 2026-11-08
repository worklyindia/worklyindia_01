import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const gradlePath = resolve("native/android/app/build.gradle.kts");
const gradle = await readFile(gradlePath, "utf8");
const versionCode = Number(gradle.match(/versionCode\s*=\s*(\d+)/)?.[1]);
const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];

if (!Number.isInteger(versionCode) || versionCode < 1 || !versionName) {
  throw new Error("Could not read Android versionCode/versionName from build.gradle.kts");
}

const metadata = {
  version_name: versionName,
  version_code: versionCode,
  min_supported_version_code: 1,
  release_notes: "Performance improvements and bug fixes.",
  application_id: "com.worklyindia.app",
  generated_from: "native/android/app/build.gradle.kts"
};

await mkdir(resolve("public"), { recursive: true });
await writeFile(resolve("public/android-app-build-info.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log("Generated Android release metadata:", versionName, "(" + versionCode + ")");
