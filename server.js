const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

// Separate Telegram bots: one handles deposit/withdrawal decisions,
// the other handles website live-support messages and replies.
const PAYMENTS_BOT_TOKEN = process.env.PAYMENTS_BOT_TOKEN;
const PAYMENTS_ADMIN_CHAT_ID = process.env.PAYMENTS_ADMIN_CHAT_ID;
const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
const SUPPORT_ADMIN_CHAT_ID = process.env.SUPPORT_ADMIN_CHAT_ID;

function createBot(token, label) {
  if (!token) {
    console.warn(`${label} Telegram bot disabled: token environment variable is not set.`);
    return null;
  }
  const bot = new TelegramBot(token, { polling: true });
  bot.on('polling_error', (err) => console.error(`${label} Telegram polling error:`, err.message));
  return bot;
}

const paymentsBot = createBot(PAYMENTS_BOT_TOKEN, 'Payments');
const supportBot = createBot(SUPPORT_BOT_TOKEN, 'Support');
const transactionMap = new Map(); // txId -> latest socket ID
const transactionStatus = new Map(); // txId -> approved/rejected status (in-memory; resets on server restart))

// Serve existing lobby and game files without changing their game code.
app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Reconnect recovery: clients resend pending transaction IDs so an approval
  // made while they were offline can still update the wallet.
  socket.on('sync_transactions', (txIds = []) => {
    if (!Array.isArray(txIds)) return;
    for (const rawId of txIds.slice(0, 100)) {
      const txId = String(rawId || '').slice(0, 100);
      if (!txId) continue;
      transactionMap.set(txId, socket.id);
      const status = transactionStatus.get(txId);
      if (status === 'approved') socket.emit('transaction_approved', txId);
      else if (status === 'rejected') socket.emit('transaction_rejected', txId);
    }
  });

  // Bot 2: Live chat / customer support only.
  socket.on('user_message', async (data = {}) => {
    const email = String(data.email || 'Unknown user').slice(0, 300);
    const message = String(data.message || '').slice(0, 3000);
    if (!message) return;
    if (!supportBot || !SUPPORT_ADMIN_CHAT_ID) {
      socket.emit('admin_reply', 'Live support is temporarily unavailable. Please try again later.');
      return;
    }
    try {
      const sentMsg = await supportBot.sendMessage(
        SUPPORT_ADMIN_CHAT_ID,
        `👤 User: ${email}\n💬 Message: ${message}\n\nReply directly to this message to answer the user.`,
        { reply_markup: { force_reply: true } }
      );
      supportBot.onReplyToMessage(String(SUPPORT_ADMIN_CHAT_ID), sentMsg.message_id, (replyMsg) => {
        if (replyMsg.text) socket.emit('admin_reply', replyMsg.text);
      });
    } catch (err) {
      console.error('Support Telegram message error:', err.message);
      socket.emit('admin_reply', 'Could not contact support right now. Please try again later.');
    }
  });

  // Bot 1: Deposit / withdrawal approvals only.
  socket.on('new_transaction', async (data = {}) => {
    const txId = String(data.txId || '').slice(0, 100);
    const type = String(data.type || '').toLowerCase();
    const amount = Number(data.amount);
    if (!txId || !['deposit', 'withdraw'].includes(type) || !Number.isFinite(amount) || amount <= 0) return;
    if (!paymentsBot || !PAYMENTS_ADMIN_CHAT_ID) {
      console.error('Payment request received but payment Telegram bot/admin chat is not configured.');
      return;
    }

    transactionMap.set(txId, socket.id);
    if (!transactionStatus.has(txId)) transactionStatus.set(txId, 'pending');
    const userId = String(data.userId || 'Unknown').slice(0, 300);
    const userName = String(data.userName || 'Unknown').slice(0, 300);
    const upi = String(data.upi || '').slice(0, 300);
    const text = `🚨 NEW ${type.toUpperCase()} REQUEST\n\n🆔 Order ID: ${txId}\n👤 User ID: ${userId}\n📛 Name: ${userName}\n💰 Amount: ₹${amount}` +
      (type === 'withdraw' ? `\n📱 UPI: ${upi}` : '') + '\n\nPlease verify and choose an action:';

    try {
      await paymentsBot.sendMessage(PAYMENTS_ADMIN_CHAT_ID, text, {
        reply_markup: { inline_keyboard: [[
          { text: '✅ Approve', callback_data: `approve_${txId}` },
          { text: '❌ Reject', callback_data: `reject_${txId}` }
        ]] }
      });
    } catch (err) {
      console.error('Payments Telegram message error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    // Keep transaction mappings so Telegram approvals still resolve after a
    // temporary disconnect; a reconnect will replace the socket ID.
    console.log('User disconnected:', socket.id);
  });
});

if (paymentsBot && PAYMENTS_ADMIN_CHAT_ID) {
  paymentsBot.on('callback_query', async (query) => {
    try {
      const raw = String(query.data || '');
      const separator = raw.indexOf('_');
      const action = raw.slice(0, separator);
      const txId = raw.slice(separator + 1);
      if (!['approve', 'reject'].includes(action) || separator < 0 || !txId) {
        await paymentsBot.answerCallbackQuery(query.id, { text: 'Invalid action.' });
        return;
      }
      if (!query.message || String(query.message.chat.id) !== String(PAYMENTS_ADMIN_CHAT_ID)) {
        await paymentsBot.answerCallbackQuery(query.id, { text: 'Not authorized for this chat.' });
        return;
      }
      const socketId = transactionMap.get(txId);
      const approved = action === 'approve';
      transactionStatus.set(txId, approved ? 'approved' : 'rejected');
      await paymentsBot.editMessageText(
        `${approved ? '✅ APPROVED' : '❌ REJECTED'}\nOrder ID: ${txId}\n\nStatus: ${approved ? 'Marked approved.' : 'Marked rejected.'}`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      if (socketId) io.to(socketId).emit(approved ? 'transaction_approved' : 'transaction_rejected', txId);
      transactionMap.delete(txId);
      await paymentsBot.answerCallbackQuery(query.id, { text: approved ? 'Approved' : 'Rejected' });
    } catch (err) {
      console.error('Payments Telegram callback error:', err.message);
      try { await paymentsBot.answerCallbackQuery(query.id, { text: 'Could not process action.' }); } catch (_) {}
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Payments Telegram integration: ${paymentsBot && PAYMENTS_ADMIN_CHAT_ID ? 'enabled' : 'disabled'}`);
  console.log(`Support Telegram integration: ${supportBot && SUPPORT_ADMIN_CHAT_ID ? 'enabled' : 'disabled'}`);
});
