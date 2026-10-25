// Jab Admin Telegram se reply kare
socket.on('admin_reply', (msg) => {
  appendMessage(`👨‍💼 <b>Support:</b> ${msg}`, 'bot');
  beep();
});

function sendMessage(customText = null) {
  const input = document.getElementById('chatInput');
  const msgText = customText || input.value.trim();
  if (!msgText) return;
  
  appendMessage(msgText, 'user');
  if(!customText) input.value = '';

  const lower = msgText.toLowerCase();
  const isIssue = lower.includes('nahi') || lower.includes('fail') || lower.includes('not') || lower.includes('agent') || lower.includes('withdraw') || lower.includes('deposit');

  // Agar user issue bata raha hai toh server ko bhejo (Telegram ke liye)
  if (isIssue) {
    socket.emit('user_message', { email: currentUser.email, message: msgText });
    appendMessage("⏳ <i>Connecting to Live Support Agent...</i>", 'bot');
    return;
  }

  showTyping();
  setTimeout(() => {
    hideTyping();
    let reply = "I'm a bot. Please use quick replies or type 'Agent'.";
    if (lower.includes('balance')) reply = `Your current balance is <b>₹${currentUser.balance}</b>.`;
    else if (lower.includes('hi')) reply = "Hello! Welcome to CroreBet Support.";
    appendMessage(reply, 'bot');
  }, 1200);
}

function attachFile() { 
  appendMessage("📎 <i>[Screenshot uploaded]</i>", 'user'); 
  socket.emit('user_message', { email: currentUser.email, message: "[Uploaded a screenshot]" }); 
  setTimeout(() => appendMessage("✅ Screenshot received. Support team will review it.", 'bot'), 1000);
}

function appendMessage(text, sender) {
  const chatBox = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = `${text} <span class="time">${time}</span>`;
  chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
  const chatBox = document.getElementById('chatMessages');
  let ind = document.getElementById('typingIndicator');
  if (!ind) { ind = document.createElement('div'); ind.id = 'typingIndicator'; ind.className = 'typing-indicator'; ind.innerHTML = '<span></span><span></span><span></span>'; chatBox.appendChild(ind); }
  ind.classList.add('show'); chatBox.scrollTop = chatBox.scrollHeight;
}
function hideTyping() { const ind = document.getElementById('typingIndicator'); if(ind) ind.classList.remove('show'); }
function beep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); osc.frequency.value = 800; osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.1); } catch(e){} }
document.addEventListener('DOMContentLoaded', () => { document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); }); });
