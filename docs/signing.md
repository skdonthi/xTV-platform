# Signing xTV Platform Artifacts

**Samsung** and **Android** production artifacts must be **signed** with the
cruiseline's own certificate; **LG/webOS does not** (an unsigned `.ipk` is
deployable — see §4). Signing is **cert-pluggable**: the build injects credentials
when available, otherwise emits an unsigned artifact + a warning (Samsung/Android
only) so the build stays green and procurement is never a blocker. Secrets are
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
| LG | `XTV_WEBOS_CLI` (path to the ares bin dir). `XTV_<LINE>_WEBOS_SIGN_KEY` is **optional** — Pro:Centric SI signing only; not needed for dev/store. |
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

**Sign via the build (recommended)** — set the profile and the build signs the
`.wgt` with `tizen package -s`:
```bash
export XTV_CCL_TIZEN_PROFILE=ccl-dev-2
npm run build:samsung -- --customer=ccl                 # signed .wgt + sssp_config.xml
npm run build:samsung -- --customer=ccl --sssp=1.01     # bump SSSP <ver> for a redeploy
```

> **App version** comes from `customers/<line>/release.json` (engineering-owned),
> or `XTV_APP_VERSION` for CI — it sets the `.wgt` name (`CCL_T65_<ver>`) and
> Android versionCode. Do **not** pass `--version` through `nx build` (nx swallows
> it). This is separate from the SSSP `<ver>` (`--sssp`), which only triggers the
> TV re-download.

> ⚠️ **A real Samsung TV rejects an UNSIGNED `.wgt`** — the packager's zip
> fallback (no profile set) installs nowhere and shows **"unable to install custom
> app."** If install fails, this is almost always the cause. Verify:
> `unzip -l <wgt> | grep -i signature` → must list `author-signature.xml` +
> `signature1.xml`. If empty, `XTV_CCL_TIZEN_PROFILE` wasn't set.

**Or sign a stage manually:**
```bash
tizen package -t wgt -s ccl-dev-2 -- \
  /abs/path/dist/platforms/samsung/ccl/tizen6/stage
# move stage/<name>.wgt → artifacts/CCL_T65_<ver>.wgt
```

**Deploy (SSSP / URL-Launcher):** copy **both** the `.wgt` and `sssp_config.xml`
to the launcher folder the TV points at. `sssp_config.xml` `<size>` must equal the
`.wgt` byte size (the build sets it); **bump `<ver>` (via `--sssp`) on every
redeploy** or the TV won't re-download a version it already tried.

> **DUID:** the distributor cert must include the target TV's DUID. A cert issued
> for one TV won't install on a different TV — re-issue the distributor cert with
> the new DUID.
>
> Known limitation: even with a partner cert, `$B2BAPIS`/avplay may require the
> MDC/B2B install channel rather than URL-Launcher download. Signing alone does
> not grant it.

---

## 4. LG / webOS (`.ipk`) — packaging & install

**webOS does NOT need a Samsung-style distributor cert.** An unsigned `.ipk` is a
valid, deployable artifact: it installs on a Dev Mode TV as-is, and the Content
Store signs on submission. Pro:Centric (SI) signing is the only exception and is
optional — set `XTV_CCL_WEBOS_SIGN_KEY` to have the build apply it.

**Prereqs:** webOS TV SDK (`ares-*` CLI), e.g. `/opt/webOS_TV_SDK/CLI/bin`.

**Package a stage** (the build does this; manual equivalent):
```bash
ares-package dist/platforms/lg/ccl/webos6/stage -o dist/platforms/lg/ccl/webos6/artifacts
```

### Dev install (Developer Mode TV)

1. **Enable Developer Mode** (one-time): Content Store → install the **Developer
   Mode** app → log in with your LG developer account → toggle **Dev Mode ON**
   (TV reboots). The app shows the TV **IP**, port **9922**, and a **passphrase**.
   Keep the TV on the same network.
2. **Register the TV** (one-time):
   ```bash
   ares-setup-device                          # add device: name, IP, port 9922
   ares-novacom --device <name> --getkey      # enter the Dev Mode passphrase
   ```
3. **Install the `.ipk`:**
   ```bash
   ares-install --device <name> \
     dist/platforms/lg/ccl/webos6/artifacts/com.xcontrol.ccl.webos_0.1.0_all.ipk
   ```
4. **Launch** (app id = LG `app-identity`):
   ```bash
   ares-launch --device <name> com.xcontrol.ccl.webos
   ```
5. **Debug (web inspector):**
   ```bash
   ares-inspect --device <name> --app com.xcontrol.ccl.webos --open
   ```

Housekeeping: `ares-install --device <name> --list` / `--remove com.xcontrol.ccl.webos`.
Dev Mode session expires ~**50 hours** — reopen the Developer Mode app and extend.

### Commercial / hospitality (fleet)

Not `ares`. Pro:Centric TVs are provisioned centrally via the **Pro:Centric Smart /
SI server** (or USB commercial config), which pushes the app to cabins. This is the
XMM / head-end integration path — separate from dev sideload.

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
