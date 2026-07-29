// PORT: video playback the app depends on, independent of any TV. Platform
// ADAPTERS below implement it against each device's real media API. Same
// ports-and-adapters shape as libs/muting. See docs/tv-platform-reference.md
// for the per-platform APIs (avplay / hcap.Media / ExoPlayer).
export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "stopped";

// Hospitality content DRM. PROIDIOM is Samsung's standard pro:idiom scheme (most
// of the CCL catalogue); LYNK is the server-keyed variant. NONE = clear stream.
export type DrmType = "NONE" | "PROIDIOM" | "LYNK";

export interface PlayerAdapter {
  load(sourceUrl: string, drm?: DrmType): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): PlaybackStatus;
  destroy(): void;
}

function globalProp<T>(name: string): T | undefined {
  return (globalThis as Record<string, unknown>)[name] as T | undefined;
}

// Samsung Tizen native media API.
type Avplay = {
  open(url: string): void;
  close(): void;
  prepare(): void;
  play(): void;
  pause(): void;
  stop(): void;
  setDisplayRect(x: number, y: number, w: number, h: number): void;
  setDrm(type: string, operation: string, jsonParams: string): void;
  getState?(): string;
};

// Android TV native bridge (ExoPlayer on the Kotlin side) — same bridge the
// audio adapter / diagnostics expect. TODO on the native side.
type AndroidPlayer = {
  load(url: string): void;
  play(): void;
  pause(): void;
  stop(): void;
};

// HTML5 <video> — works in the browser (dev) AND on webOS, which supports
// standard media. Used as the default and as the off-device fallback so the app
// never throws when a native API is missing.
function createHtml5Player(): PlayerAdapter {
  const doc = globalProp<Document>("document");
  let video: HTMLVideoElement | undefined;
  let status: PlaybackStatus = "idle";

  function ensure(): HTMLVideoElement | undefined {
    if (!doc) {
      return undefined;
    }
    if (!video) {
      video = doc.createElement("video");
      video.setAttribute("playsinline", "");
      video.style.position = "fixed";
      video.style.top = "0";
      video.style.left = "0";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.background = "#000";
      doc.body.appendChild(video);
    }
    return video;
  }

  return {
    async load(url, _drm) {
      // HTML5 has no pro:idiom/LYNK support; drm is ignored (dev/webOS clear only).
      status = "loading";
      const element = ensure();
      if (element) {
        element.style.display = "block";
        element.src = url;
        element.load();
      }
    },
    async play() {
      status = "playing";
      await ensure()
        ?.play()
        .catch(() => {});
    },
    async pause() {
      status = "paused";
      video?.pause();
    },
    async stop() {
      status = "stopped";
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        // Hide the element — otherwise its black fill covers the UI after stop.
        video.style.display = "none";
      }
    },
    getStatus() {
      return status;
    },
    destroy() {
      status = "idle";
      video?.remove();
      video = undefined;
    },
  };
}

// Tizen composites avplay video on a hardware plane BEHIND the web layer. The
// Blits WebGL canvas (and its opaque background Element) sit on top and hide it,
// so the movie plays but is invisible. While playing we hide the canvas and make
// the page transparent so the video plane shows through; restored on stop.
function showVideoPlane(on: boolean): void {
  const doc = globalProp<Document>("document");
  if (!doc) {
    return;
  }
  const canvas = doc.querySelector("canvas") as HTMLElement | null;
  const root = doc.documentElement;
  const app = doc.getElementById("app");
  if (on) {
    root.style.background = "transparent";
    doc.body.style.background = "transparent";
    if (app) app.style.background = "transparent";
    if (canvas) canvas.style.visibility = "hidden";
  } else {
    root.style.background = "";
    doc.body.style.background = "";
    if (app) app.style.background = "";
    if (canvas) canvas.style.visibility = "";
  }
}

// Samsung Tizen: webapis.avplay (needed for live-TV + DRM). Falls back to HTML5
// off-device or when avplay is absent (dev).
function createAvplayPlayer(): PlayerAdapter {
  const avplay = globalProp<{ avplay?: Avplay }>("webapis")?.avplay;
  if (!avplay) {
    return createHtml5Player();
  }
  let status: PlaybackStatus = "idle";
  return {
    async load(url, drm) {
      status = "loading";
      // Tizen 6 avplay chokes on an upper-case .MPG extension (legacy CCL quirk).
      const src = url.replace(/\.MPG(\?|$)/, ".mpg$1");
      const state = avplay.getState?.();
      if (state === "PLAYING" || state === "PAUSED") {
        avplay.stop();
        avplay.close();
      }
      avplay.open(src);
      avplay.setDisplayRect(0, 0, 1920, 1080);
      // DRM handshake MUST run after open() and before prepare() (legacy CCL
      // createVideo order). PROIDIOM ForensicData is a required non-empty field
      // whose value is arbitrary.
      if (drm === "PROIDIOM") {
        avplay.setDrm("PROIDIOM", "Initialize", JSON.stringify({ type: "0", ForensicData: "xtv" }));
      } else if (drm === "LYNK") {
        // ponytail: LYNK needs the head-end key server (ip:port) in tenant config;
        // wire when a LYNK title actually ships. PROIDIOM covers today's catalogue.
        console.warn("avplay: LYNK DRM requested but LYNK server is not configured");
      }
      avplay.prepare();
    },
    async play() {
      status = "playing";
      avplay.play();
      showVideoPlane(true);
    },
    async pause() {
      status = "paused";
      avplay.pause();
    },
    async stop() {
      status = "stopped";
      avplay.stop();
      showVideoPlane(false);
    },
    getStatus() {
      return status;
    },
    destroy() {
      status = "idle";
      avplay.close();
      showVideoPlane(false);
    },
  };
}

// Android TV: delegate to the native ExoPlayer bridge; HTML5 fallback in WebView/dev.
function createAndroidPlayer(): PlayerAdapter {
  const bridge = globalProp<{ player?: AndroidPlayer }>("xtvAndroid")?.player;
  if (!bridge) {
    return createHtml5Player();
  }
  let status: PlaybackStatus = "idle";
  return {
    async load(url, _drm) {
      // ExoPlayer DRM is handled natively on the Kotlin side; drm hint unused here.
      status = "loading";
      bridge.load(url);
    },
    async play() {
      status = "playing";
      bridge.play();
    },
    async pause() {
      status = "paused";
      bridge.pause();
    },
    async stop() {
      status = "stopped";
      bridge.stop();
    },
    getStatus() {
      return status;
    },
    destroy() {
      status = "idle";
      bridge.stop();
    },
  };
}

// FACTORY: pick the adapter for the running platform. LG/webOS uses HTML5 (webOS
// supports it; hcap.Media can replace it later if a device needs it). Unknown
// platform → HTML5, so this never throws on the wrong device.
export function createPlayerAdapter(platform: string): PlayerAdapter {
  if (platform === "samsung") {
    return createAvplayPlayer();
  }
  if (platform === "android") {
    return createAndroidPlayer();
  }
  return createHtml5Player();
}
