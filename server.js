// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;

// Simpan user & OTP sementara (untuk demo — tidak disimpan permanen)
let users = [];
let otpStore = {};

// Middleware
app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Redirect ke login
app.get('/', (req, res) => res.redirect('/login.html'));

// === REGISTER ===
app.post('/register', async (req, res) => {
  const { fullname, email, username, password } = req.body;
  if (!fullname || !email || !username || !password) {
    return res.status(400).send('<script>alert("Semua kolom wajib diisi"); window.location="/register.html";</script>');
  }
  if (users.some(u => u.email === email)) {
    return res.status(400).send('<script>alert("Email sudah terdaftar"); window.location="/register.html";</script>');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ fullname, email, username, password: hashedPassword });
  res.redirect('/login.html');
});

// === LOGIN ===
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).send('<script>alert("Email tidak ditemukan"); window.location="/login.html";</script>');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).send('<script>alert("Password salah"); window.location="/login.html";</script>');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { code: otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };

  try {
    await sendOTPEmail(email, otp);
    res.redirect(`/otp.html?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('❌ Gagal kirim OTP:', err.message);
    res.status(500).send('<script>alert("Gagal mengirim OTP. Coba lagi nanti."); window.location="/login.html";</script>');
  }
});

// === VERIFY OTP ===
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore[email];
  if (!stored || new Date() > stored.expiresAt) {
    delete otpStore[email];
    return res.status(400).send('<script>alert("OTP kadaluarsa"); window.location="/login.html";</script>');
  }
  if (stored.code !== otp) {
    return res.status(400).send(`<script>alert("OTP salah"); window.location="/otp.html?email=${encodeURIComponent(email)}";</script>`);
  }
  delete otpStore[email];

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).send('<script>alert("Akun tidak ditemukan"); window.location="/login.html";</script>');
  }

  res.redirect(`/set-session?email=${encodeURIComponent(email)}&fullname=${encodeURIComponent(user.fullname)}&username=${encodeURIComponent(user.username)}`);
});

// === SET LOCAL STORAGE → DASHBOARD ===
app.get('/set-session', (req, res) => {
  const { email, fullname, username } = req.query;
  if (!email || !fullname || !username) {
    return res.status(400).send('<script>alert("Data sesi tidak valid"); window.location="/login.html";</script>');
  }

  const script = `
    <script>
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', JSON.stringify({
        email: "${email}",
        fullname: "${fullname}",
        username: "${username}"
      }));
      window.location.href = '/dashboard.html';
    </script>
  `;
  res.send(script);
});

// === KIRIM EMAIL KE EMAIL ASLI (GMAIL) ===
async function sendOTPEmail(to, otp) {
  // 🔑 GANTI DENGAN DATA GMAIL-MU DI BAWAH INI
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'panelmurah2025@gmail.com',
      pass: 'abcdefghijklmnop'
    }
  });

  await transporter.sendMail({
    from: '"Panel Murah" <akunsultanff123rbt@gmail.com>', // ← HARUS SAMA DENGAN 'user' DI ATAS
    to,
    subject: 'Kode Verifikasi Login - Panel Murah',
    text: `Kode OTP kamu: ${otp}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background: #f9f9f9;">
      <h2 style="color: #d32f2f;">Panel Murah</h2>
      <p>Kode verifikasi 6 digit kamu:</p>
      <h1 style="font-size: 32px; color: #333; letter-spacing: 8px;">${otp}</h1>
      <p>Berlaku selama <strong>5 menit</strong>. Jangan berikan kode ini ke siapa pun.</p>
    </div>`
  });
}

// === KIRIM OTP DARI HALAMAN REGISTER ===
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email diperlukan' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { code: otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };

  try {
    await sendOTPEmail(email, otp);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error /send-otp:', err.message);
    res.status(500).json({ error: 'Gagal kirim OTP' });
  }
});

// === JALANKAN SERVER ===
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di: http://localhost:${PORT}`);
  console.log(`📧 Pastikan kredensial Gmail di 'sendOTPEmail' sudah benar!`);
});