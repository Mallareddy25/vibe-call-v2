import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Sequelize, DataTypes, Op } from 'sequelize';
import nodemailer from 'nodemailer';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = "vibe_call_secret_12345";

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// --- MODELS ---
const User: any = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  otp: { type: DataTypes.STRING },
  profilePicture: { type: DataTypes.STRING, defaultValue: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user' },
  onlineStatus: { type: DataTypes.STRING, defaultValue: 'offline' },
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
  plan: { type: DataTypes.STRING, defaultValue: 'free' },
  dailyDownloadCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastDownloadDate: { type: DataTypes.STRING, defaultValue: '' }
});

const FriendRequest: any = sequelize.define('FriendRequest', {
  senderId: { type: DataTypes.INTEGER },
  receiverId: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

const Friend: any = sequelize.define('Friend', {
  userId: { type: DataTypes.INTEGER },
  friendId: { type: DataTypes.INTEGER }
});

const Call: any = sequelize.define('Call', {
  callerId: { type: DataTypes.INTEGER },
  receiverId: { type: DataTypes.INTEGER },
  duration: { type: DataTypes.INTEGER },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  wasRecorded: { type: DataTypes.BOOLEAN },
  callType: { type: DataTypes.STRING, defaultValue: 'video' }
});

const Download: any = sequelize.define('Download', {
  userId: { type: DataTypes.INTEGER },
  callId: { type: DataTypes.INTEGER },
  fileName: { type: DataTypes.STRING },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// --- ASSOCIATIONS ---
FriendRequest.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
FriendRequest.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
Download.belongsTo(User, { foreignKey: 'userId' });
Call.belongsTo(User, { as: 'caller', foreignKey: 'callerId' });
Call.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });

// SYNC WITH ERROR LOGGING
sequelize.sync().then(() => {
  console.log('✅ SQL Database (SQLite) Connected & Synced with new Plan Schema');
}).catch(err => {
  console.error('❌ SYNC ERROR:', err);
});

// --- EMAIL NOTIFICATIONS (Test Account) ---
let transporter: any;
nodemailer.createTestAccount().then(account => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('📧 Email System Ready (Ethereal test mode)');
});

// --- ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePicture = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
    const user: any = await User.create({ name, email, password: hashedPassword, phone, profilePicture });
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name, email, profilePicture, isPremium: false, plan: 'free' } });
  } catch (e: any) { 
    console.error('Register Error:', e.message);
    res.status(400).json({ message: "Error: " + e.message }); 
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, region } = req.body;
    const user: any = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();

    const southStates = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana'];
    const isSouth = southStates.includes(region);

    if (isSouth) {
      if (transporter) {
        await transporter.sendMail({
          from: '"VibeCall Security" <security@vibecall.com>',
          to: user.email,
          subject: `VibeCall Login OTP`,
          text: `Your OTP for login is ${otp}`
        });
      }
      console.log(`[MOCK EMAIL OTP] Sent OTP ${otp} to Email ${user.email}`);
      res.json({ requireOtp: true, via: 'email', otp, message: `OTP sent to email ${user.email}` });
    } else {
      console.log(`[MOCK SMS] Sent OTP ${otp} to Mobile ${user.phone}`);
      res.json({ requireOtp: true, via: 'sms', otp, message: `OTP sent to mobile ${user.phone || 'registered number'}` });
    }
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/auth/login-verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user: any = await User.findOne({ where: { email } });
    if (!user || user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    
    user.otp = null;
    await user.save();
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, profilePicture: user.profilePicture, isPremium: user.isPremium, plan: user.plan || 'free' } });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post('/api/premium/upgrade', async (req, res) => {
  const { userId, plan } = req.body;
  const user: any = await User.findByPk(userId);
  if (user) {
    user.plan = plan;
    user.isPremium = (plan === 'gold'); // Gold unlocks unlimited downloads
    await user.save();
    
    try {
      if (transporter) {
        const price = plan === 'bronze' ? '₹10' : plan === 'silver' ? '₹50' : '₹100';
        const info = await transporter.sendMail({
          from: '"VibeCall Billing" <billing@vibecall.com>',
          to: user.email,
          subject: `Invoice: VibeCall ${plan.toUpperCase()} Plan`,
          html: `<h3>Hello ${user.name},</h3>
                 <p>Your payment was successful. Welcome to the <b>${plan.toUpperCase()}</b> plan!</p>
                 <br/>
                 <b>Invoice Details:</b><br/>
                 Plan: ${plan.toUpperCase()}<br/>
                 Amount Paid: ${price}<br/>
                 <p>Enjoy your extended viewing limits!</p>`
        });
        console.log('📧 INVOICE EMAIL SENT! Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
    } catch (emailError) {
      console.error("Failed to send email invoice:", emailError);
    }

    res.json({ message: "Upgraded!", user: { id: user.id, name: user.name, email: user.email, profilePicture: user.profilePicture, isPremium: user.isPremium, plan: user.plan } });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.post('/api/downloads/check', async (req, res) => {
  try {
    const { userId } = req.body;
    const user: any = await User.findByPk(userId);
    if (!user) return res.json({ allowed: false, message: "User not found" });
    if (user.isPremium) return res.json({ allowed: true });
    
    // Bulletproof: Count actual downloads for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const count = await Download.count({
      where: {
        userId: userId,
        date: { [Op.gte]: today }
      }
    });

    if (count >= 1) {
      return res.json({ allowed: false, message: "Free limit reached (1/day). Upgrade to Premium for unlimited downloads!" });
    }
    res.json({ allowed: true });
  } catch (error) {
    console.error("Check Error:", error);
    res.json({ allowed: false, message: "Server error checking limit." });
  }
});

app.post('/api/downloads/save', async (req, res) => {
  try {
    const { userId, callId, fileName } = req.body;
    await Download.create({ userId, callId, fileName });
    res.json({ message: "Download logged successfully" });
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ message: "Failed to log download" });
  }
});

app.get('/api/downloads/list/:userId', async (req, res) => {
  const downloads = await Download.findAll({ where: { userId: req.params.userId }, order: [['date', 'DESC']] });
  res.json(downloads);
});

app.delete('/api/downloads/delete/:id', async (req, res) => {
  await Download.destroy({ where: { id: req.params.id } });
  res.json({ message: "Deleted" });
});

app.put('/api/downloads/rename/:id', async (req, res) => {
  const { fileName } = req.body;
  await Download.update({ fileName }, { where: { id: req.params.id } });
  res.json({ message: "Renamed" });
});

app.get('/api/users/search', async (req, res) => {
  const { query, userId } = req.query;
  const users = await User.findAll({ 
    where: { 
      [Op.or]: [{ name: { [Op.like]: `%${query}%` } }, { email: { [Op.like]: `%${query}%` } }],
      id: { [Op.ne]: userId }
    }
  });
  res.json(users);
});

app.post('/api/friends/request', async (req, res) => {
  const { senderId, receiverId } = req.body;
  await FriendRequest.create({ senderId, receiverId });
  res.json({ message: "Sent" });
});

app.get('/api/friends/requests/:userId', async (req, res) => {
  const requests = await FriendRequest.findAll({ 
    where: { receiverId: req.params.userId, status: 'pending' },
    include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'profilePicture'] }]
  });
  res.json(requests);
});

app.post('/api/friends/respond', async (req, res) => {
  const { requestId, status } = req.body;
  const request: any = await FriendRequest.findByPk(requestId);
  if (request) {
    request.status = status;
    await request.save();
    if (status === 'accepted') {
      await Friend.create({ userId: request.senderId, friendId: request.receiverId });
      await Friend.create({ userId: request.receiverId, friendId: request.senderId });
    }
  }
  res.json({ message: "Done" });
});

app.get('/api/friends/list/:userId', async (req, res) => {
  const friends = await Friend.findAll({ where: { userId: req.params.userId } });
  const friendIds = friends.map((f: any) => f.friendId);
  const userList = await User.findAll({ where: { id: friendIds } });
  res.json(userList);
});

app.post('/api/calls/save', async (req, res) => {
  const call = await Call.create(req.body);
  res.json(call);
});

app.get('/api/calls/history/:userId', async (req, res) => {
  const history = await Call.findAll({ 
    where: { [Op.or]: [{ callerId: req.params.userId }, { receiverId: req.params.userId }] },
    order: [['date', 'DESC']],
    include: [
      { model: User, as: 'caller', attributes: ['id', 'name', 'profilePicture'] },
      { model: User, as: 'receiver', attributes: ['id', 'name', 'profilePicture'] }
    ]
  });
  res.json(history);
});

const onlineUsers = new Map();
io.on('connection', (socket) => {
  socket.on('register-user', async (userId) => {
    if (!userId) return;
    onlineUsers.set(userId.toString(), socket.id);
    await User.update({ onlineStatus: 'online' }, { where: { id: userId } });
    io.emit('status-change', { userId, status: 'online' });
  });

  socket.on('call-user', ({ to, offer, from, callerName }) => {
    const targetSocket = onlineUsers.get(to.toString());
    if (targetSocket) io.to(targetSocket).emit('incoming-call', { from, offer, callerName });
  });

  socket.on('answer-call', ({ to, answer }) => {
    const targetSocket = onlineUsers.get(to.toString());
    if (targetSocket) io.to(targetSocket).emit('call-answered', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to.toString());
    if (targetSocket) io.to(targetSocket).emit('ice-candidate', { candidate });
  });

  socket.on('end-call', ({ to }) => {
    const targetSocket = onlineUsers.get(to?.toString());
    if (targetSocket) io.to(targetSocket).emit('call-ended');
  });

  socket.on('sync-comments', (data) => {
    io.emit('sync-comments', data);
  });

  socket.on('disconnect', async () => {
    let disconnectedId;
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }
    if (disconnectedId) {
      await User.update({ onlineStatus: 'offline' }, { where: { id: disconnectedId } });
      io.emit('status-change', { userId: disconnectedId, status: 'offline' });
    }
  });
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 VibeCall Engine Fixed with Debugging`));
