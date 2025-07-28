const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const axios = require("axios");
const { spawn } = require("child_process");
const qr = require("qrcode-terminal"); // Tambahan untuk QR balok

// Server untuk Railway agar tetap hidup
require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot WA APEM aktif!");
  })
  .listen(3000);

// Dummy isi jika belum pakai AI
const chatRandom = [
  "Iya, ada apa?",
  "Lagi sibuk, tapi ente keren.",
  "Coba ente ulangi, tadi gangguan sinyal.",
];

async function aiReply(text) {
  return "Maaf, ente ngomong apa barusan?";
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  const store = makeInMemoryStore({ logger: P().child({ level: "silent" }) });

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
  });

  sock.ev.on("connection.update", (update) => {
    const { qr: qrCode, connection, lastDisconnect } = update;

    if (qrCode) {
      console.log("📸 Silakan scan QR Code berikut ini:");
      qr.generate(qrCode); // Cetak QR dalam bentuk balok
    }

    if (connection === "close") {
      const reasonCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reasonCode !== DisconnectReason.loggedOut;
      console.log("❌ Koneksi terputus. Reconnect:", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot WA APEM siap digunakan!");
    }
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
}

startBot();
