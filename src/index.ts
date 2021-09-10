import { Handler, Router } from "worktop";
import * as Cache from "worktop/cache";
import * as CORS from "worktop/cors";
import { createMemoryNote, NoteArguments } from "./note/Note";
import { createCloudflareStorage } from "./note/adapters/cloudflare";

declare var API_TOKEN: string;
const API = new Router();
declare let MEMORY_NOTE: KVNamespace;
const memoryNote = createMemoryNote({
    storage: createCloudflareStorage({
        kvStorage: MEMORY_NOTE
    })
});

const Auth: Handler<{ token: string }> = (req, res) => {
    const token = req.query.get("token");
    if (token !== API_TOKEN) {
        res.send(400);
    }
};

/**
 * Handles `OPTIONS` requests using the same settings.
 * NOTE: Call `CORS.preflight` per-route for inidivual settings.
 */
API.prepare = (req, res) => {
    CORS.preflight({
        origin: "*", // allow any `Origin` to connect
        headers: ["Cache-Control", "Content-Type"],
        methods: ["GET", "HEAD", "PUT", "POST", "DELETE"]
    })(req as any, res);
    Auth(req as any, res);
};

API.add("GET", "/notes/recent/:range", async (req, res) => {
    const rangeValue = Number(req.params.range);
    if (rangeValue < 0 || rangeValue > 30) {
        return res.send(400, "invalid range: 0 ~ 30");
    }
    const notes = await memoryNote.readNotes(rangeValue ?? 10);
    res.send(200, notes);
});
API.add("POST", "/notes/new", async (req, res) => {
    const note = await req.body<NoteArguments>();
    if (!note) {
        return res.send(400, "invalid note");
    }
    await memoryNote.pushNote(note);
    res.send(200, { ok: true });
});
API.add("PUT", "/notes/:id", async (req, res) => {
    const note = await req.body<NoteArguments>();
    if (!note) {
        return res.send(400, "invalid note");
    }
    await memoryNote.editNote(req.params.id, note);
    res.send(200, { ok: true });
});
API.add("DELETE", "/notes/:id", async (req, res) => {
    const nodeId = req.params.id;
    if (!nodeId) {
        return res.send(400, "invalid node.id");
    }
    await memoryNote.deleteNote(nodeId);
    res.send(200, { ok: true });
});

// Attach "fetch" event handler
// ~> use `Cache` for request-matching, when permitted
// ~> store Response in `Cache`, when permitted
Cache.listen(API.run);
