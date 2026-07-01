// Cert-pluggable signing credential resolution, keyed by (cruiseline, platform).
//
// Source order (later wins):
//   1. signing/.signing.local.json  (gitignored, for local dev)
//   2. environment variables         (CI / per-build)
//
// Env contract, namespaced per cruiseline so AIDA and CCL never share a cert:
//   Samsung:  XTV_<LINE>_TIZEN_PROFILE         (Tizen Certificate Manager profile name)
//             XTV_TIZEN_CLI                    (path to the `tizen` bin dir, shared)
//   LG:       XTV_<LINE>_WEBOS_SIGN_KEY        (Pro:Centric signing cert/key path)
//             XTV_WEBOS_CLI                    (path to the ares bin dir, shared)
//   Android:  XTV_<LINE>_ANDROID_KEYSTORE      (.jks path)
//             XTV_<LINE>_ANDROID_KS_PASS
//             XTV_<LINE>_ANDROID_KEY_ALIAS
//             XTV_<LINE>_ANDROID_KEY_PASS
//
// <LINE> = customer slug upper-cased, non-alphanumerics -> "_" (e.g. ccl -> CCL).
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localFilePath = resolve(workspaceRoot, "signing/.signing.local.json");

function readLocalSigning() {
  if (!existsSync(localFilePath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(localFilePath, "utf8"));
  } catch (error) {
    console.warn(`Could not parse signing/.signing.local.json: ${error.message}`);
    return {};
  }
}

function envKey(customer, suffix) {
  const line = customer.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_");
  return `XTV_${line}_${suffix}`;
}

/**
 * Resolve signing credentials for one matrix cell.
 * @returns {{ available: boolean, platform: string } & Record<string, string|undefined>}
 */
export function resolveSigning({ customer, platform }) {
  const local = readLocalSigning();
  const localCell = local?.[customer]?.[platform] ?? {};
  const env = process.env;

  if (platform === "samsung") {
    const profile = env[envKey(customer, "TIZEN_PROFILE")] ?? localCell.profile;
    return {
      platform,
      available: Boolean(profile),
      profile,
      tizenCli: env.XTV_TIZEN_CLI ?? local?.tizenCli,
    };
  }

  if (platform === "lg") {
    const signKey = env[envKey(customer, "WEBOS_SIGN_KEY")] ?? localCell.signKey;
    return {
      platform,
      available: Boolean(signKey),
      signKey,
      aresCli: env.XTV_WEBOS_CLI ?? local?.aresCli,
    };
  }

  if (platform === "android") {
    const keystore = env[envKey(customer, "ANDROID_KEYSTORE")] ?? localCell.keystore;
    return {
      platform,
      available: Boolean(keystore),
      keystore,
      keystorePass: env[envKey(customer, "ANDROID_KS_PASS")] ?? localCell.keystorePass,
      keyAlias: env[envKey(customer, "ANDROID_KEY_ALIAS")] ?? localCell.keyAlias,
      keyPass: env[envKey(customer, "ANDROID_KEY_PASS")] ?? localCell.keyPass,
    };
  }

  return { platform, available: false };
}

/** Loud, unmissable warning when a cell builds without a cert. */
export function warnUnsigned(customer, platform) {
  const suffix =
    platform === "samsung"
      ? "TIZEN_PROFILE"
      : platform === "lg"
        ? "WEBOS_SIGN_KEY"
        : "ANDROID_KEYSTORE";
  console.warn(
    [
      "",
      "  ============================================================",
      `   SIGNING SKIPPED — ${customer} / ${platform} artifact is UNSIGNED.`,
      `   Set ${envKey(customer, suffix)} (or signing/.signing.local.json)`,
      "   to produce a production-deployable signed artifact.",
      "  ============================================================",
      "",
    ].join("\n"),
  );
}
