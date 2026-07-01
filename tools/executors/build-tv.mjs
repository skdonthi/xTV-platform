import { spawnSync } from "node:child_process";
import { resolveCustomerSlug } from "../customer-slug.mjs";

const args = parseArgs(process.argv.slice(2));
const app = required(args.app, "app");
// Resolve alias -> slug ONCE here; everything downstream (Vite tenant alias,
// packager) receives the resolved slug so only one tenant is ever compiled in.
const customer = resolveCustomerSlug(args.customer);
const profile = args.profile ?? defaultProfileFor(app);
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
