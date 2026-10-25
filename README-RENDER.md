# Crorebet project — Render deployment (two Telegram bots)

## Deploy as a Render Web Service
1. Extract this ZIP and push the contents of `casino-games-eight-files/` to the root of a GitHub repository. Alternatively, if you commit the parent folder as-is, set Render's **Root Directory** to `casino-games-eight-files`.
2. In Render, choose **New → Web Service** and connect the repository.
3. Use **Build Command**: `npm install`
4. Use **Start Command**: `npm start`
5. Add the Environment Variables listed below in Render. Never commit real bot tokens to GitHub.
6. After deploy, open the Render URL. `/health` should return `{"status":"ok"}`.

## Environment Variables

Configure the two bots separately in Render → your service → Environment:

- `PAYMENTS_BOT_TOKEN` — Bot 1 token from BotFather; handles deposit/withdrawal requests and Approve/Reject buttons.
- `PAYMENTS_ADMIN_CHAT_ID` — Telegram chat ID where payment requests should be sent.
- `SUPPORT_BOT_TOKEN` — Bot 2 token from BotFather; handles website live-chat messages and support replies.
- `SUPPORT_ADMIN_CHAT_ID` — Telegram chat ID where customer-support messages should be sent.

Add both bots to their intended Telegram chats and ensure each bot can send messages there. For live support, reply directly to the bot's message in Telegram. Payment requests and customer support use separate bots and separate environment variables.

## Notes and limitations
- Existing game HTML pages, CSS, and frontend JavaScript files are preserved unchanged.
- The server serves the existing files and Socket.IO connects on the same deployed origin.
- Either Telegram integration can be disabled by leaving its variables unset; the web service can still start.
- Transaction-to-browser mapping is stored in memory and is lost on restart/disconnect. This is a demo setup, not a production-ready real-money payment system. Use secure authentication, durable transaction storage, server-side balance management, validation, and appropriate legal/compliance review before handling real funds.
- The current lobby links to `7updown.html` and `andarbahar.html`, but those files are not included in this ZIP.
