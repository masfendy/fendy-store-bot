const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // <-- Memanggil library qrcode

const app = express();
const port = 3000;
app.use(express.json());

// --- FUNGSI BOT WHATSAPP ---
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    // printQRInTerminal: true, // <-- Baris ini sudah dihapus
    logger: pino({ level: 'silent' }) // Kembalikan ke silent agar terminal rapi
  });

  sock.ev.on('creds.update', saveCreds);

  // Pantau status koneksi (Scan QR, Terhubung, atau Terputus)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update; // Menangkap objek 'qr'
    
    // --- MENCETAK QR CODE KE TERMINAL ---
    if (qr) {
        console.log('⏳ Silakan scan QR Code di bawah ini menggunakan aplikasi WhatsApp Anda:');
        qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Koneksi terputus. Mencoba menghubungkan ulang...', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Bot WhatsApp Berhasil Terhubung!');
    }
  });

  // Pantau pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return; 

    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const sender = msg.key.remoteJid;

    console.log(`📩 Pesan masuk dari ${sender}: ${textMessage}`);

    if (textMessage && textMessage.toLowerCase() === 'ping') {
      await sock.sendMessage(sender, { text: 'Pong! 🚀 Bot kamu sudah aktif dan siap jualan.' });
    }
  });
}

connectToWhatsApp();

// --- ENDPOINT EXPRESS ---
app.get('/', (req, res) => {
  res.send('Server Bot WhatsApp & QRIS berjalan lancar!');
});

app.post('/webhook/qris', (req, res) => {
  console.log('Webhook Payment Gateway hit!');
  res.status(200).json({ status: 'success' });
});

app.listen(port, () => {
  console.log(`🚀 Server Express berjalan di http://localhost:${port}`);
});