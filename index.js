const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const axios = require("axios");
const { spawn } = require("child_process");

// 🔄 Uptime checker (Replit / UptimeRobot)
require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot WA APEM aktif!");
  })
  .listen(3000);

// 🎲 Balasan acak lucu
const chatRandom = [
  "Ngapain tag-tag gua, Njir? 😒",
  "Lagi sibuk ngadepin customer paket pesbuk",
  "Waduh, nt manggil bot mbut",
  "APEM di sini, santai aja sayang 💦",
  "Bot bukan pesuruh, tod 😤",
  "Lagi ngitung jumlah paket bumijawa",
  "Kalo butuh update, bilang aja... jangan malu-maluin! tod",
  "Cieee yang nyari perhatian 😏, haha kntl",
  "Iya iya... dipanggil mulu, kayak mantan aja.",
  "Bot-nya capek, dielus dulu dong! ",
];

// ✅ Revisi khusus bagian AI saja
async function aiReply(userMessage) {
  const prompt = `Balas santai dan nyeleneh: "${userMessage}"`;

  try {
    const res = await axios.post(
      "",
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 50,
          temperature: 0.7,
          top_p: 0.9,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const hasil = res.data?.[0]?.generated_text?.replace(prompt, "")?.trim();
    return hasil || "Hmm... APEM bingung, ulangi ya 😅";
  } catch (err) {
    console.error("❌ Gagal akses Hugging Face:", err.message);
    return "Saya lagi males sama kamu";
  }
}

// 🚀 Start WA bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  const store = makeInMemoryStore({ logger: P().child({ level: "silent" }) });

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: "silent" }),
  });

  store.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    const pesan =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";
    const mentionedJid =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderTag = sender.split("@")[0];

    if (isGroup && mentionedJid.includes(botId)) {
      const pesanLower = pesan.toLowerCase();
      const isUpdatePaket = pesanLower.includes("update paket");
      console.log("📨 Tag terdeteksi:", pesan);

      if (isUpdatePaket) {
        const namaKurir = pesanLower.split("update paket")[1]?.trim() || "";
        await sock.sendMessage(
          from,
          {
            text: `Tunggu sebentar @${senderTag}, sedang mengambil data dari langit...`,
            mentions: [sender],
          },
          { quoted: msg }
        );

        const args = namaKurir ? [namaKurir] : [];
        const py = spawn("python", ["cariKurir.py", ...args]);

        let hasil = "";
        py.stdout.on("data", (data) => (hasil += data.toString()));
        py.stderr.on("data", (err) =>
          console.error("❌ Python error:", err.toString())
        );

        py.on("close", async () => {
          await sock.sendMessage(
            from,
            {
              text: `@${senderTag}\n${hasil || "Tidak ada hasil Njir."}`,
              mentions: [sender],
            },
            { quoted: msg }
          );
        });

        py.on("error", async (err) => {
          await sock.sendMessage(
            from,
            {
              text: `Gagal menjalankan script Python Njir.`,
              mentions: [sender],
            },
            { quoted: msg }
          );
        });
      } else {
        // 🔄 Balas pakai AI atau random (70% random)
        const pakaiRandom = Math.random() < 0.7;

        const balasan = pakaiRandom
          ? chatRandom[Math.floor(Math.random() * chatRandom.length)]
          : await aiReply(pesan);

        await sock.sendMessage(
          from,
          {
            text: `@${senderTag} ${balasan}`,
            mentions: [sender],
          },
          { quoted: msg }
        );
      }
    }
  });

  console.log("✅ Bot aktif dan menunggu pesan...");
}

startBot();