import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = parseArgs(process.argv.slice(2));
const app = required(args.app, "app");
const customer = args.customer ?? "demo-hotel";
const profile = args.profile ?? defaultProfileFor(app);
const version = args.version ?? readPackageVersion();
const appMeta = createAppMeta({ app, customer, profile, version });
const webBundleDir = resolve(workspaceRoot, "dist/apps", `${app}-tv`);
const platformOutDir = resolve(workspaceRoot, "dist/platforms", app, customer, profile);
const stageDir = join(platformOutDir, "stage");
const artifactsDir = join(platformOutDir, "artifacts");

await ensureWebBundle(webBundleDir, app);
await rm(platformOutDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await mkdir(artifactsDir, { recursive: true });

if (app === "samsung") {
  await packageSamsung({ webBundleDir, stageDir, artifactsDir, appMeta });
} else if (app === "lg") {
  await packageLg({ webBundleDir, stageDir, artifactsDir, appMeta });
} else if (app === "android") {
  await packageAndroid({ webBundleDir, stageDir, artifactsDir, appMeta });
} else {
  throw new Error(`Unsupported TV app "${app}".`);
}

await writeBuildManifest({ appMeta, platformOutDir, stageDir, artifactsDir });
console.log(`Packaged ${app} output at ${relative(workspaceRoot, platformOutDir)}`);

async function packageSamsung({ webBundleDir, stageDir, artifactsDir, appMeta }) {
  await cp(webBundleDir, stageDir, { recursive: true });
  await renderTemplate("platforms/samsung/templates/config.xml", join(stageDir, "config.xml"), {
    APP_ID: appMeta.appId,
    DISPLAY_NAME: appMeta.displayName,
    TIZEN_APP_ID: "xTVPlatform.app",
    TIZEN_PACKAGE_ID: "xTVPlatform",
    TIZEN_VERSION: appMeta.profile.replace("tizen", ""),
    VERSION: appMeta.version,
  });
  await writePlaceholderPng(join(stageDir, "icon.png"));

  const artifactPath = join(artifactsDir, `${appMeta.packageName}.wgt`);
  if (hasCommand("zip")) {
    execFileSync("zip", ["-qr", artifactPath, "."], { cwd: stageDir, stdio: "inherit" });
  } else {
    console.warn("zip command not found. Samsung stage output was created without .wgt archive.");
  }
}

async function packageLg({ webBundleDir, stageDir, artifactsDir, appMeta }) {
  await cp(webBundleDir, stageDir, { recursive: true });
  await renderTemplate("platforms/lg/templates/appinfo.json", join(stageDir, "appinfo.json"), {
    APP_ID: appMeta.appId,
    DISPLAY_NAME: appMeta.displayName,
    VERSION: appMeta.version,
  });
  await writePlaceholderPng(join(stageDir, "icon.png"));
  await writePlaceholderPng(join(stageDir, "largeIcon.png"));

  if (hasCommand("ares-package")) {
    execFileSync("ares-package", [stageDir, "-o", artifactsDir], { stdio: "inherit" });
  } else {
    await writeFile(
      join(artifactsDir, "README.txt"),
      [
        "LG webOS package stage created.",
        "Install LG CLI tools and run:",
        `ares-package ${relative(workspaceRoot, stageDir)} -o ${relative(workspaceRoot, artifactsDir)}`,
        "",
      ].join("\n"),
    );
    console.warn("ares-package not found. LG stage output was created without .ipk archive.");
  }
}

async function packageAndroid({ webBundleDir, stageDir, artifactsDir, appMeta }) {
  await cp(resolve(workspaceRoot, "platforms/android/templates"), stageDir, { recursive: true });
  await cp(webBundleDir, join(stageDir, "app/src/main/assets"), { recursive: true });
  await renderTemplate(
    "platforms/android/templates/settings.gradle",
    join(stageDir, "settings.gradle"),
    {},
  );
  await renderTemplate(
    "platforms/android/templates/build.gradle",
    join(stageDir, "build.gradle"),
    {},
  );
  await renderTemplate(
    "platforms/android/templates/app/build.gradle",
    join(stageDir, "app/build.gradle"),
    {
      ANDROID_APPLICATION_ID: appMeta.androidApplicationId,
      VERSION: appMeta.version,
      VERSION_CODE: appMeta.versionCode,
    },
  );
  await renderTemplate(
    "platforms/android/templates/app/src/main/AndroidManifest.xml",
    join(stageDir, "app/src/main/AndroidManifest.xml"),
    {
      DISPLAY_NAME: appMeta.displayName,
    },
  );

  if (hasCommand("gradle")) {
    const result = spawnSync("gradle", ["assembleRelease"], { cwd: stageDir, stdio: "inherit" });

    if (result.status === 0) {
      await cp(
        join(stageDir, "app/build/outputs/apk/release/app-release-unsigned.apk"),
        join(artifactsDir, `${appMeta.packageName}.apk`),
      );
    } else {
      throw new Error("Android Gradle package failed.");
    }
  } else {
    await writeFile(
      join(artifactsDir, "README.txt"),
      [
        "Android TV project stage created.",
        "Install Android SDK and Gradle, then run:",
        `cd ${relative(workspaceRoot, stageDir)}`,
        "gradle assembleRelease",
        "",
      ].join("\n"),
    );
    console.warn("gradle not found. Android stage output was created without .apk archive.");
  }
}

async function renderTemplate(templatePath, outputPath, replacements) {
  const absoluteTemplatePath = resolve(workspaceRoot, templatePath);
  const template = await readFile(absoluteTemplatePath, "utf8");
  const rendered = Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, String(value)),
    template,
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered);
}

async function writeBuildManifest({ appMeta, platformOutDir, stageDir, artifactsDir }) {
  const artifacts = existsSync(artifactsDir) ? await listFiles(artifactsDir) : [];

  await writeFile(
    join(platformOutDir, "build-manifest.json"),
    `${JSON.stringify(
      {
        ...appMeta,
        createdAt: new Date().toISOString(),
        stageDir: relative(workspaceRoot, stageDir),
        artifactsDir: relative(workspaceRoot, artifactsDir),
        artifacts: artifacts.map((artifact) => relative(platformOutDir, artifact)),
      },
      null,
      2,
    )}\n`,
  );
}

async function listFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const entryStat = await stat(path);

    if (entryStat.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

async function ensureWebBundle(webBundleDir, app) {
  if (!existsSync(join(webBundleDir, "index.html"))) {
    throw new Error(`Missing ${app} web bundle. Run the Vite build before packaging.`);
  }
}

async function writePlaceholderPng(path) {
  const onePixelPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  await writeFile(path, Buffer.from(onePixelPng, "base64"));
}

function createAppMeta({ app, customer, profile, version }) {
  const normalizedCustomer = customer.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const normalizedProfile = profile.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

  return {
    app,
    appId: `com.xtv.${normalizedCustomer}.${app}`,
    androidApplicationId: `com.xtv.${normalizedCustomer.replaceAll("-", "")}.${app}`,
    customer,
    displayName: `xTV ${customer}`,
    packageName: `xtv-${normalizedCustomer}-${app}-${normalizedProfile}-${version}`,
    profile,
    version,
    versionCode: versionToCode(version),
  };
}

function versionToCode(version) {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return Number(major) * 10000 + Number(minor) * 100 + Number(patch);
}

function hasCommand(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(resolve(workspaceRoot, "package.json"), "utf8"));
  return packageJson.version;
}

function parseArgs(rawArgs) {
  return rawArgs.reduce((parsed, arg) => {
    if (!arg.startsWith("--")) {
      return parsed;
    }

    const [key, value] = arg.slice(2).split("=");
    parsed[key] = value ?? true;
    return parsed;
  }, {});
}

function required(value, name) {
  if (!value) {
    throw new Error(`Missing required argument --${name}.`);
  }

  return value;
}

function defaultProfileFor(app) {
  if (app === "samsung") {
    return "tizen6";
  }

  if (app === "lg") {
    return "webos6";
  }

  return "android-tv-12";
}
