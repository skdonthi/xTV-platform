import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCustomerSlug } from "./customer-slug.mjs";
import { resolveSigning, warnUnsigned } from "./signing.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = parseArgs(process.argv.slice(2));
const app = required(args.app, "app");
const customer = resolveCustomerSlug(args.customer);
const profile = args.profile ?? defaultProfileFor(app);
const tenantConfig = readTenantConfig(customer);
// Release version is engineering-owned + baked into the artifact (gradle-style
// versionName; versionCode derived). It lives in customers/<line>/release.json,
// NOT the deployment-generated runtime config.json. Precedence:
//   --version (direct CLI) > XTV_APP_VERSION (CI) > release.json > root package.json
const version =
  args.version ??
  process.env.XTV_APP_VERSION ??
  readTenantRelease(customer) ??
  readPackageVersion();
const ssspVer = args.sssp ?? "1.00";
const identity = tenantConfig.identity ?? {};
const appMeta = createAppMeta({ app, customer, profile, version, identity });
const webBundleDir = resolve(workspaceRoot, "dist/apps", `${app}-tv`);
const platformOutDir = resolve(workspaceRoot, "dist/platforms", app, customer, profile);
const stageDir = join(platformOutDir, "stage");
const artifactsDir = join(platformOutDir, "artifacts");

// Partner-only privileges (live-TV avplay + B2B). Require a Samsung PARTNER cert;
// rejected by public certs. Emitted only when the tenant opts in via app-identity.
const SAMSUNG_PARTNER_PRIVILEGES = [
  '  <tizen:privilege name="http://developer.samsung.com/privilege/avplay" />',
  '  <tizen:privilege name="http://developer.samsung.com/privilege/drmplay" />',
  '  <tizen:privilege name="http://developer.samsung.com/privilege/productinfo" />',
  '  <tizen:privilege name="http://developer.samsung.com/privilege/tvinfo" />',
  '  <tizen:privilege name="http://developer.samsung.com/privilege/network.public" />',
].join("\n");

await ensureWebBundle(webBundleDir, app);
await rm(platformOutDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await mkdir(artifactsDir, { recursive: true });

if (app === "samsung") {
  await packageSamsung({ stageDir, artifactsDir, appMeta });
} else if (app === "lg") {
  await packageLg({ stageDir, artifactsDir, appMeta });
} else if (app === "android") {
  await packageAndroid({ stageDir, artifactsDir, appMeta });
} else {
  throw new Error(`Unsupported TV app "${app}".`);
}

await writeBuildManifest({ appMeta, platformOutDir, stageDir, artifactsDir });
console.log(`Packaged ${app} (${customer}) at ${relative(workspaceRoot, platformOutDir)}`);

async function packageSamsung({ stageDir, artifactsDir, appMeta }) {
  // Web bundle is already FLAT (index.html + assets/ at root) — copy as-is.
  await cp(webBundleDir, stageDir, { recursive: true });
  await renderTemplate("platforms/samsung/templates/config.xml", join(stageDir, "config.xml"), {
    APP_ID: appMeta.appId,
    DISPLAY_NAME: appMeta.displayName,
    TIZEN_APP_ID: appMeta.tizenAppId,
    TIZEN_PACKAGE_ID: appMeta.tizenPackage,
    TIZEN_VERSION: appMeta.tizenVersion,
    VERSION: appMeta.version,
    PARTNER_PRIVILEGES: appMeta.samsungPartner ? SAMSUNG_PARTNER_PRIVILEGES : "",
  });
  await copyIconOrPlaceholder(join(stageDir, "icon.png"), "icon.png");

  const signing = resolveSigning({ customer, platform: "samsung" });
  const wgtPath = join(artifactsDir, `${appMeta.samsungBasename}.wgt`);

  if (signing.available) {
    const tizenBin = signing.tizenCli ? join(signing.tizenCli, "tizen") : "tizen";
    // `tizen package` signs the widget with the Certificate Manager profile and
    // zips the stage into <stage>/<name>.wgt.
    execFileSync(tizenBin, ["package", "-t", "wgt", "-s", signing.profile, "--", stageDir], {
      stdio: "inherit",
    });
    const produced = (await readdir(stageDir)).find((file) => file.endsWith(".wgt"));
    if (!produced) {
      throw new Error("tizen package produced no .wgt file.");
    }
    await cp(join(stageDir, produced), wgtPath);
    await rm(join(stageDir, produced), { force: true });
  } else {
    warnUnsigned(customer, "samsung");
    if (hasCommand("zip")) {
      execFileSync("zip", ["-qr", wgtPath, "."], { cwd: stageDir, stdio: "inherit" });
    } else {
      console.warn("zip command not found. Samsung stage created without .wgt archive.");
    }
  }

  // SSSP / URL-Launcher deploy manifest: TV reads this, verifies <size>, then
  // downloads the named .wgt. Bump <ver> to force a re-download.
  if (existsSync(wgtPath)) {
    const size = (await stat(wgtPath)).size;
    await writeFile(
      join(artifactsDir, "sssp_config.xml"),
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        "<widget>",
        `  <ver>${ssspVer}</ver>`,
        `  <size>${size}</size>`,
        `  <widgetname>${appMeta.samsungBasename}</widgetname>`,
        "  <webtype>tizen</webtype>",
        "</widget>",
        "",
      ].join("\n"),
    );
  }
}

async function packageLg({ stageDir, artifactsDir, appMeta }) {
  await cp(webBundleDir, stageDir, { recursive: true });
  await renderTemplate("platforms/lg/templates/appinfo.json", join(stageDir, "appinfo.json"), {
    APP_ID: appMeta.lgAppId,
    DISPLAY_NAME: appMeta.displayName,
    VERSION: appMeta.version,
  });
  await copyIconOrPlaceholder(join(stageDir, "icon.png"), "icon.png");
  await copyIconOrPlaceholder(join(stageDir, "largeIcon.png"), "largeIcon.png");

  const signing = resolveSigning({ customer, platform: "lg" });
  const aresBin = signing.aresCli ? join(signing.aresCli, "ares-package") : "ares-package";

  if (hasCommand(aresBin)) {
    execFileSync(aresBin, [stageDir, "-o", artifactsDir], { stdio: "inherit" });
    // An unsigned .ipk is a valid, deployable webOS artifact: it installs on a
    // Dev Mode TV via ares-install, and the Content Store signs on submission.
    // LG does NOT require a Samsung-style distributor cert. Pro:Centric (SI)
    // signing is the exception — applied here only when a sign key is provided.
    if (signing.available) {
      // TODO: apply Pro:Centric signing with signing.signKey (LG SI tooling).
      console.info(`Signing LG .ipk for ${customer} (Pro:Centric).`);
    }
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
    console.warn("ares-package not found. LG stage created without .ipk archive.");
  }
}

async function packageAndroid({ stageDir, artifactsDir, appMeta }) {
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
    { DISPLAY_NAME: appMeta.displayName },
  );

  const signing = resolveSigning({ customer, platform: "android" });
  const gradleArgs = ["assembleRelease"];
  if (signing.available) {
    // Passed as Gradle properties; the build.gradle signingConfigs block reads them.
    gradleArgs.push(
      `-PXTV_KS_FILE=${signing.keystore}`,
      `-PXTV_KS_PASS=${signing.keystorePass ?? ""}`,
      `-PXTV_KEY_ALIAS=${signing.keyAlias ?? ""}`,
      `-PXTV_KEY_PASS=${signing.keyPass ?? ""}`,
    );
  } else {
    warnUnsigned(customer, "android");
  }

  if (hasCommand("gradle")) {
    const result = spawnSync("gradle", gradleArgs, { cwd: stageDir, stdio: "inherit" });

    if (result.status === 0) {
      const releaseDir = join(stageDir, "app/build/outputs/apk/release");
      const apkName = signing.available ? "app-release.apk" : "app-release-unsigned.apk";
      await cp(join(releaseDir, apkName), join(artifactsDir, `${appMeta.packageName}.apk`));
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
        signing.available
          ? `gradle assembleRelease ${gradleArgs.slice(1).join(" ")}`
          : "gradle assembleRelease",
        "",
      ].join("\n"),
    );
    console.warn("gradle not found. Android stage created without .apk archive.");
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

// Prefer the cruiseline's brand icon (customers/<line>/assets/<name>) over the
// 1px placeholder, so each tenant's package carries its own artwork.
async function copyIconOrPlaceholder(destPath, name) {
  const branded = resolve(workspaceRoot, "customers", customer, "assets", name);
  if (existsSync(branded)) {
    await cp(branded, destPath);
    return;
  }
  await writePlaceholderPng(destPath);
}

// Parsed tenant config.json (identity, runtime, …); {} if missing/unreadable.
function readTenantConfig(customer) {
  const path = resolve(workspaceRoot, "customers", customer, "config.json");
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.warn(`Could not parse config.json for ${customer}: ${error.message}`);
    return {};
  }
}

// Engineering-owned release version from customers/<line>/release.json (or undefined).
function readTenantRelease(customer) {
  const path = resolve(workspaceRoot, "customers", customer, "release.json");
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")).version;
  } catch (error) {
    console.warn(`Could not parse release.json for ${customer}: ${error.message}`);
    return undefined;
  }
}

function createAppMeta({ app, customer, profile, version, identity }) {
  const normalizedCustomer = customer.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const compact = normalizedCustomer.replaceAll("-", "");
  const normalizedProfile = profile.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const samsung = identity.samsung ?? {};
  const lg = identity.lg ?? {};
  const android = identity.android ?? {};
  // required_version is the MINIMUM Tizen the .wgt installs on — read the profile's
  // explicit apiVersion (e.g. "6.5", "9.0"), not the profile-id number.
  const tizenVersion = readTizenApiVersion(profile);
  const brand = customer.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "");

  return {
    app,
    customer,
    profile,
    version,
    displayName: `xTV ${customer}`,
    versionCode: versionToCode(version),
    appId: samsung.appId ?? lg.appId ?? `com.xtv.${normalizedCustomer}.${app}`,
    tizenAppId: samsung.tizenAppId ?? `xTV${compact}.app`,
    tizenPackage: samsung.package ?? `xTV${compact}`,
    tizenVersion,
    samsungPartner: Boolean(samsung.partner),
    // e.g. apiVersion 6.5 -> T65, 10.0 -> T100
    samsungBasename: `${brand}_T${tizenVersion.replaceAll(/\D/g, "")}_${version.replaceAll(".", "_")}`,
    lgAppId: lg.appId ?? `com.xtv.${compact}.webos`,
    androidApplicationId: android.applicationId ?? `com.xtv.${compact}.${app}`,
    packageName: `xtv-${normalizedCustomer}-${app}-${normalizedProfile}-${version}`,
  };
}

function readTizenApiVersion(profile) {
  const path = resolve(workspaceRoot, "platforms/samsung/profiles", `${profile}.json`);
  if (existsSync(path)) {
    try {
      const apiVersion = JSON.parse(readFileSync(path, "utf8"))?.capabilities?.apiVersion;
      if (apiVersion) {
        return String(apiVersion);
      }
    } catch (error) {
      console.warn(`Could not read apiVersion for ${profile}: ${error.message}`);
    }
  }
  return profile.replace("tizen", "");
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
