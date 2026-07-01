import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCustomerSlug } from "../packaging/customer-slug.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = parseArgs(process.argv.slice(2));
const app = required(args.app, "app");
// Resolve alias -> slug ONCE here; everything downstream (Vite tenant alias,
// packager) receives the resolved slug so only one tenant is ever compiled in.
const customer = resolveCustomerSlug(args.customer);
const profile = args.profile ?? defaultProfileFor(app);

// Materialize the active tenant's public/ (fonts, brand assets) into the app's
// public dir. Blits' msdf generator scans <appRoot>/public (hard-coded), so the
// tenant's assets must live there at build time. Cleaned + recopied each build,
// so only the active cruiseline's assets are ever present (isolation). The app
// public dir is gitignored (generated).
const appPublic = resolve(workspaceRoot, "apps", `${app}-tv`, "public");
const tenantPublic = resolve(workspaceRoot, "customers", customer, "public");
rmSync(appPublic, { recursive: true, force: true });
if (existsSync(tenantPublic)) {
  cpSync(tenantPublic, appPublic, { recursive: true });
}
const command = args.serve ? "vite" : "vite";
const devHost = process.env.XTV_DEV_HOST ?? "127.0.0.1";
const viteArgs = args.serve
  ? ["--config", `apps/${app}-tv/vite.config.ts`, "--host", devHost]
  : ["build", "--config", `apps/${app}-tv/vite.config.ts`];

const result = spawnSync(command, viteArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VITE_XTV_CUSTOMER: customer,
    VITE_XTV_PROFILE: profile,
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!args.serve) {
  const packageResult = spawnSync(
    "node",
    [
      "tools/packaging/package-tv.mjs",
      `--app=${app}`,
      `--customer=${customer}`,
      `--profile=${profile}`,
      ...(args.version ? [`--version=${args.version}`] : []),
      ...(args.sssp ? [`--sssp=${args.sssp}`] : []),
    ],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  );

  process.exit(packageResult.status ?? 1);
}

process.exit(0);

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
