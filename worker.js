// Misty Swamp lobby server (relay): passes multiplayer messages between players.
//
//   wss://<this worker>/ws/<code>     a lobby: everyone who connects with the same code shares one swamp
//   https://<this worker>/            sends you to the game on GitHub Pages (the game files live there)
//
// Each lobby code is its own Durable Object. It keeps every player's latest "presence" (their position, health,
// and, for the host, the enemy snapshot) in memory and forwards each update to the other players in that lobby.
// The game itself decides who hosts; this server never looks inside the messages beyond checking they are JSON.

import { DurableObject } from "cloudflare:workers";

const GAME_URL = "https://popogjo420-creator.github.io/Swamp/";   // where the game is played

const CODE_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;   // same rule as the game's lobby codes
const PEER_RE = /^[a-z0-9]{8,32}$/;
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;
const MAX_PLAYERS = 8;
const MAX_MESSAGE = 256 * 1024;                   // the host's enemy snapshot can be a few KB; this leaves lots of room

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const lobby = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (lobby) {
      let code;
      try { code = decodeURIComponent(lobby[1]).toLowerCase(); } catch (e) { code = ""; }
      if (!CODE_RE.test(code)) return new Response("That is not a valid lobby code.", { status: 400 });
      if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
        return new Response("This address is for the game's multiplayer connection.", { status: 426 });
      }
      const stub = env.LOBBY.get(env.LOBBY.idFromName(code));
      return stub.fetch(request);
    }
    if (url.pathname === "/health") return new Response("ok");
    // every other address: the game lives on GitHub Pages
    return Response.redirect(GAME_URL, 302);
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.pres = new Map(); // peer -> { raw: their presence as JSON text, at: when it last changed }
    // keepalive pings are answered by Cloudflare directly, without waking this object or counting as a request
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong")); } catch (e) {}
  }

  peerOf(ws) {
    try { const a = ws.deserializeAttachment(); return a ? a.peer : null; } catch (e) { return null; }
  }

  send(ws, text) {
    try { ws.send(text); } catch (e) {}
  }

  broadcast(text, exceptPeer) {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.peerOf(ws) !== exceptPeer) this.send(ws, text);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    let peer = (url.searchParams.get("peer") || "").toLowerCase();
    if (!PEER_RE.test(peer)) peer = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer });

    // a player reconnecting keeps their id: their old, dead connection is closed without telling anyone they left
    const others = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === server) continue;
      const p = this.peerOf(ws);
      if (p === peer) { try { ws.serializeAttachment({ peer: null }); ws.close(4001, "replaced by a newer connection"); } catch (e) {} continue; }
      if (p) others.push(p);
    }
    if (others.length >= MAX_PLAYERS) {
      this.send(server, '{"t":"full","max":' + MAX_PLAYERS + "}");
      try { server.serializeAttachment({ peer: null }); server.close(4000, "lobby full"); } catch (e) {}
      return new Response(null, { status: 101, webSocket: client });
    }

    const list = others.map((p) => {
      const e = this.pres.get(p);
      return '{"peer":"' + p + '","at":' + (e ? e.at : 0) + ',"d":' + (e ? e.raw : "{}") + "}";
    });
    this.send(server, '{"t":"hello","you":"' + peer + '","peers":[' + list.join(",") + "]}");
    this.broadcast('{"t":"join","peer":"' + peer + '"}', peer);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const peer = this.peerOf(ws);
    if (!peer || typeof message !== "string" || message.length > MAX_MESSAGE) return;
    if (message === "ping") { this.send(ws, "pong"); return; }
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    if (!m || typeof m !== "object") return;

    if (m.t === "p" && m.d && typeof m.d === "object" && !Array.isArray(m.d)) {
      // presence: this player's whole current state. Keep it for newcomers and pass it on.
      const raw = JSON.stringify(m.d);
      const at = Date.now();
      this.pres.set(peer, { raw, at });
      this.broadcast('{"t":"p","peer":"' + peer + '","at":' + at + ',"d":' + raw + "}", peer);
    } else if (m.t === "e" && typeof m.topic === "string" && TOPIC_RE.test(m.topic)) {
      // a one-off event: goes to everyone, the sender included (the same as Claude's room)
      const d = m.d === undefined ? "null" : JSON.stringify(m.d);
      this.broadcast('{"t":"e","peer":"' + peer + '","topic":"' + m.topic + '","d":' + d + "}", null);
    }
  }

  async webSocketClose(ws, code, reason) {
    this.gone(ws);
    try { ws.close(code, reason); } catch (e) {}
  }

  async webSocketError(ws) {
    this.gone(ws);
  }

  gone(ws) {
    const peer = this.peerOf(ws);
    if (!peer) return;
    try { ws.serializeAttachment({ peer: null }); } catch (e) {}
    for (const o of this.ctx.getWebSockets()) {
      if (o !== ws && this.peerOf(o) === peer) return; // they already reconnected
    }
    this.pres.delete(peer);
    this.broadcast('{"t":"leave","peer":"' + peer + '"}', peer);
  }
}
