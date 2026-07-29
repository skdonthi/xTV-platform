// Local test head-end for on-TV testing of the two live channels:
//   - muting:        pushes {type:"audio.mute"} → app mutes + shows announcement overlay
//   - config.updated: pushes {type:"config.updated"} → app re-fetches /config/ccl.json (theme) + reloads
// One port for both (HTTP config + WS). Control from stdin. ponytail: dev-only harness.
//
//   node tools/test-headend.mjs
//   > mute        > unmute        > night|sea|day|sunset (theme)        > help
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = 9099;
let theme = "carnival-night"; // what GET /config/ccl.json currently serves

const http = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // app runs under file:// (origin null)
  if (req.url?.startsWith("/config/")) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ runtime: { theme } })); // deep-merged over bundled config
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

const wss = new WebSocketServer({ server: http });
const broadcast = (obj) => {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
  console.log("→", msg, `(${wss.clients.size} client(s))`);
};
wss.on("connection", () => console.log(`client connected (${wss.clients.size} total)`));

http.listen(PORT, () => {
  console.log(`test head-end on :${PORT}  (ws + http)`);
  console.log("commands: mute | unmute | night | sea | day | sunset | help");
});

process.stdin.on("data", (buf) => {
  const cmd = buf.toString().trim();
  if (cmd === "mute") {
    broadcast({
      type: "audio.mute",
      payload: {
        muted: true,
        title: "Ship Announcement",
        message: "Muster drill: please proceed to your station.",
      },
    });
  } else if (cmd === "unmute") {
    broadcast({ type: "audio.mute", payload: { muted: false } });
  } else if (["night", "sea", "day", "sunset"].includes(cmd)) {
    theme = `carnival-${cmd}`;
    broadcast({ type: "config.updated" }); // app re-fetches /config/ccl.json (new theme) + reloads
  } else {
    console.log("commands: mute | unmute | night | sea | day | sunset");
  }
});
