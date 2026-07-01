# Signing xTV Platform Artifacts

Every production TV artifact must be **signed** with the cruiseline's own
certificate. Signing is **cert-pluggable**: the build injects credentials when
they are available and otherwise emits an **unsigned** artifact plus a loud
warning (the build stays green so procurement is never a blocker). Secrets are
**never** committed.

This guide covers both paths:
- **Automated** — how the build injects signing.
- **Manual** — the exact commands to sign a staged artifact by hand.

---

## 1. Where credentials come from

The resolver `tools/packaging/signing.mjs` reads, per `(cruiseline, platform)`:

1. Environment variables (CI / per-build), **namespaced by cruiseline**.
2. Fallback: a gitignored `signing/.signing.local.json` (copy from
   `signing/signing.example.json`).

`<LINE>` = customer slug upper-cased, non-alphanumerics → `_` (e.g. `ccl` → `CCL`).

| Platform | Variables |
|---|---|
| Samsung | `XTV_<LINE>_TIZEN_PROFILE` (Certificate Manager profile name), `XTV_TIZEN_CLI` (path to the `tizen` bin dir) |
| LG | `XTV_<LINE>_WEBOS_SIGN_KEY` (Pro:Centric signing cert), `XTV_WEBOS_CLI` (path to the ares bin dir) |
| Android | `XTV_<LINE>_ANDROID_KEYSTORE`, `XTV_<LINE>_ANDROID_KS_PASS`, `XTV_<LINE>_ANDROID_KEY_ALIAS`, `XTV_<LINE>_ANDROID_KEY_PASS` |

Example (CCL):

```bash
export XTV_CCL_TIZEN_PROFILE=ccl-dev-2
export XTV_CCL_ANDROID_KEYSTORE=/secure/ccl.jks
export XTV_CCL_ANDROID_KS_PASS=…  XTV_CCL_ANDROID_KEY_ALIAS=ccl  XTV_CCL_ANDROID_KEY_PASS=…
npm run build:samsung -- --customer=ccl
```

With no credentials set, the build prints `SIGNING SKIPPED — …` and produces an
unsigned artifact.

---

## 2. Build output layout

Each build produces a **stage** (the unpacked app + manifest) and **artifacts**
(the packaged file). Manual signing operates on the stage.

```
dist/platforms/<app>/<customer>/<profile>/
  ├── stage/       # unpacked: index.html, assets/, config.xml | appinfo.json | android project
  └── artifacts/   # CCL_T6_x_y_z.wgt + sssp_config.xml | *.ipk | *.apk
```

To stage without signing: `npm run build:<app> -- --customer=ccl` (unsigned), then
sign the stage manually with the commands below.

---

## 3. Samsung / Tizen (`.wgt`)

**Prereqs:** Tizen Studio + the TV extension. The `tizen` CLI lives at:
```
~/.tizen-extension-platform/server/sdktools/data/tools/ide/bin
```

**Certificate levels** (choose by what the app needs):
- Public CA (`VD DEVELOPER Public CA Class`) — installs on a real TV, UI works, **no** `$B2BAPIS`/avplay.
- **Partner CA** (`VD DEVELOPER Partner CA Class`, e.g. `ccl-dev-2`) — required for live-TV avplay + B2B. Enable partner privileges by setting `identity.samsung.partner: true` in the tenant `config.json`.

**Create a signing profile** (once) in Tizen Certificate Manager, or via CLI:
```bash
tizen security-profiles add -n ccl-dev-2 \
  -a /path/to/author.p12 -p <authorPass> \
  -d /path/to/distributor.p12 -dp <distributorPass>
```

**Sign + package a stage:**
```bash
cd ~/.tizen-extension-platform/server/sdktools/data/tools/ide/bin
./tizen package -t wgt -s ccl-dev-2 -- \
  /abs/path/dist/platforms/samsung/ccl/tizen6/stage
# produces stage/<name>.wgt — move it to artifacts/ and name it CCL_T6_<ver>.wgt
```

**Deploy (SSSP / URL-Launcher):** copy **both** the `.wgt` and `sssp_config.xml`
to the launcher folder the TV points at. `sssp_config.xml` `<size>` must equal the
`.wgt` byte size (the build generates it correctly); bump `<ver>` to force a
re-download.

> Known limitation: even with a partner cert, `$B2BAPIS`/avplay may require the
> MDC/B2B install channel rather than URL-Launcher download. Signing alone does
> not grant it.

---

## 4. LG / webOS (`.ipk`)

**Prereqs:** webOS TV SDK (`ares-*` CLI), e.g. `/opt/webOS_TV_SDK/CLI/bin`.

**Package a stage:**
```bash
ares-package dist/platforms/lg/ccl/webos6/stage -o dist/platforms/lg/ccl/webos6/artifacts
```

**Install to a dev TV / emulator:**
```bash
ares-setup-device        # register the TV once
ares-install --device <name> dist/platforms/lg/ccl/webos6/artifacts/*.ipk
```

**Pro:Centric (hospitality) signing:** the `.ipk` is signed with the LG SI /
Pro:Centric certificate using LG's tooling once the cert is provisioned. Set
`XTV_CCL_WEBOS_SIGN_KEY` so the automated build applies it.

---

## 5. Android TV (`.apk`)

**Prereqs:** Android SDK + Gradle.

**Create a release keystore** (once):
```bash
keytool -genkeypair -v -keystore ccl.jks -alias ccl \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Sign via Gradle** (the template's `signingConfigs.release` reads these props):
```bash
cd dist/platforms/android/ccl/android-tv-12/stage
gradle assembleRelease \
  -PXTV_KS_FILE=/secure/ccl.jks -PXTV_KS_PASS=… \
  -PXTV_KEY_ALIAS=ccl -PXTV_KEY_PASS=…
# signed APK: app/build/outputs/apk/release/app-release.apk
```

**Or sign an existing unsigned APK** with apksigner:
```bash
apksigner sign --ks /secure/ccl.jks --ks-key-alias ccl \
  --out ccl-release.apk app-release-unsigned.apk
apksigner verify ccl-release.apk
```

**Deploy (hospitality sideload):** `adb install ccl-release.apk`, or push via MDM.

---

## 6. Quick verification

| Platform | Verify command |
|---|---|
| Samsung | Install the `.wgt` on a real Tizen TV via SSSP; confirm it boots (CSP fix) |
| LG | `ares-install` to emulator/dev TV |
| Android | `apksigner verify <apk>` then `adb install` |
