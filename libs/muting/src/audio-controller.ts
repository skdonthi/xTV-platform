// PORT: the abstraction the muting feature depends on. It knows nothing about
// any specific TV — only that "something can be muted". Platform ADAPTERS below
// implement it against each real device API. This is dependency inversion: add
// a platform by adding an adapter, never by editing the controller.
export interface AudioController {
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

// Narrow, guarded views of the platform globals (untyped at runtime on TVs).
// We never assume the API exists — every adapter degrades to a safe local flag.
type TizenAudio = { setMute(muted: boolean): void; getMute(): boolean };
type WebosService = {
  request(uri: string, params: { method: string; parameters: Record<string, unknown> }): void;
};
type AndroidBridge = { setMuted(muted: boolean): void };

function globalProp<T>(name: string): T | undefined {
  return (globalThis as Record<string, unknown>)[name] as T | undefined;
}

// Samsung Tizen: tizen.tvaudiocontrol (needs the tv.audio / volume.set privilege
// already declared in the Tizen config.xml template).
function createTizenAudio(): AudioController {
  const audio = globalProp<{ tvaudiocontrol?: TizenAudio }>("tizen")?.tvaudiocontrol;
  let muted = false;
  return {
    setMuted(next) {
      muted = next;
      audio?.setMute(next);
    },
    isMuted() {
      return audio ? audio.getMute() : muted;
    },
  };
}

// LG webOS: the luna audio service.
function createWebosAudio(): AudioController {
  const webos = globalProp<{ service?: WebosService }>("webOS")?.service;
  let muted = false;
  return {
    setMuted(next) {
      muted = next;
      webos?.request("luna://com.webos.audio", {
        method: "setMuted",
        parameters: { muted: next },
      });
    },
    isMuted() {
      return muted;
    },
  };
}

// Android TV: goes through the JS<->native bridge (globalThis.xtvAndroid), same
// bridge the diagnostics device-info layer expects. Native side calls AudioManager.
function createAndroidAudio(): AudioController {
  const bridge = globalProp<AndroidBridge>("xtvAndroid");
  let muted = false;
  return {
    setMuted(next) {
      muted = next;
      bridge?.setMuted(next);
    },
    isMuted() {
      return muted;
    },
  };
}

// Browser / dev fallback: no real TV audio bus — track intent so the app behaves
// and logs, without throwing on a machine that has none of the TV globals.
function createBrowserAudio(): AudioController {
  let muted = false;
  return {
    setMuted(next) {
      muted = next;
    },
    isMuted() {
      return muted;
    },
  };
}

// FACTORY: pick the adapter for the running platform. Unknown platform → browser
// fallback, so this can never throw on the wrong device.
export function createAudioController(platform: string): AudioController {
  if (platform === "samsung") {
    return createTizenAudio();
  }
  if (platform === "lg") {
    return createWebosAudio();
  }
  if (platform === "android") {
    return createAndroidAudio();
  }
  return createBrowserAudio();
}
