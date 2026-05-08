import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const app = required(args.app, "app");
const customer = args.customer ?? "demo-hotel";
const profile = args.profile ?? defaultProfileFor(app);
const command = args.serve ? "vite" : "vite";
const viteArgs = args.serve
  ? ["--config", `apps/${app}-tv/vite.config.ts`, "--host", "0.0.0.0"]
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

process.exit(result.status ?? 1);

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
