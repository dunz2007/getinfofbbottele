const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const { handleDownloader, setupAudioButton } = require('./utils/downloader');
const { getToken, getTokens, saveTokens, addToken, removeToken, getTokenCount, getFacebookInfo } = require('./utils/facebook');
const fs = require('fs');
const path = require('path');

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false,
  request: { timeout: 60000 }
});

(async () => {
  try {
    const updates = await bot.getUpdates({ timeout: 0 });

    if (updates.length > 0) {
      const lastUpdateId = updates[updates.length - 1].update_id;

      await bot.getUpdates({
        offset: lastUpdateId + 1,
        timeout: 0
      });
    }

    await bot.startPolling({
      params: {
        allowed_updates: ["message", "callback_query", "message_reaction"]
      }
    });

    console.log("✅ Đã bỏ qua toàn bộ update cũ.");
  } catch (err) {
    console.error(err);
  }
})();

setupAudioButton(bot);

const ADMIN_ID = process.env.ADMIN_ID;
const CONFIG_PATH = path.join(__dirname, 'data/config.json');

// Tạo file config nếu chưa có
if (!fs.existsSync(CONFIG_PATH)) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    tokens: [],
    lastUpdated: null,
    updatedBy: null
  }, null, 2));
}

const userStates = {};

function getStateKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function setUserState(chatId, userId, state) {
  userStates[getStateKey(chatId, userId)] = state;
}

function getUserState(chatId, userId) {
  return userStates[getStateKey(chatId, userId)];
}

function clearUserState(chatId, userId) {
  delete userStates[getStateKey(chatId, userId)];
}

function isAdmin(userId) {
  return String(userId) === String(ADMIN_ID);
}

function getMainMenuText(userId) {
  return `
🤖 Chào mừng bạn đến với Lemon Media!

Tôi có thể giúp bạn:

📌 🔍 Tra cứu Facebook:
• Lấy thông tin chi tiết từ profile Facebook

📌 📥 Tải video / ảnh / nhạc:
• Hỗ trợ 64+ nền tảng

${isAdmin(userId) ? '🛠️ Bạn là **Admin** - Có quyền quản lý token!' : ''}

👇 **Chọn chức năng bên dưới:**
  `;
}

// Keyboard chính
function getMainKeyboard(userId) {
  const isAdminUser = isAdmin(userId);
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔍 Tra cứu Facebook', callback_data: 'search' }],
      [{ text: '⬇️ Tải video / ảnh / nhạc đa nền tảng', callback_data: 'download_media' }],
      [{ text: '📋 Hướng dẫn sử dụng', callback_data: 'help' }]
    ]
  };
  if (isAdminUser) {
    keyboard.inline_keyboard.push([
      { text: '⚙️ Quản lý Token', callback_data: 'admin_token' }
    ]);
  }
  return keyboard;
}

// Keyboard admin token
function getAdminTokenKeyboard() {
  const tokens = getTokens();
  const hasTokens = tokens.length > 0;
  
  const keyboard = {
    inline_keyboard: []
  };

  // Hiển thị số lượng token
  if (hasTokens) {
    keyboard.inline_keyboard.push([
      { text: `📊 Tổng: ${tokens.length} token`, callback_data: 'list_tokens' }
    ]);
    keyboard.inline_keyboard.push([
      { text: '👀 Xem token đang dùng', callback_data: 'view_current_token' },
      { text: '🔄 Chuyển token', callback_data: 'switch_token' }
    ]);
    keyboard.inline_keyboard.push([
      { text: '➕ Thêm token', callback_data: 'add_token' },
      { text: '🗑️ Xóa token', callback_data: 'remove_token' }
    ]);
  } else {
    keyboard.inline_keyboard.push([
      { text: '➕ Thêm token đầu tiên', callback_data: 'add_token' }
    ]);
  }

  // Thêm nút quay lại
  keyboard.inline_keyboard.push([
    { text: '🔙 Quay lại', callback_data: 'back_main' }
  ]);

  return keyboard;
}

// Format thông tin
function formatUserInfo(info) {
  const workInfo = info.work && info.work.length > 0 
    ? info.work.map(w => `• ${w.employer?.name || 'Không rõ'}`).join('\n')
    : 'Không có thông tin';

  return `
📱 **THÔNG TIN FACEBOOK**
━━━━━━━━━━━━━━━━━━━━

👤 **Tên:** ${info.name}
🔗 **Link:** ${info.link_profile}
🆔 **UID:** ${info.uid}
📛 **Username:** @${info.username || 'Không có'}

📅 **Tạo tài khoản:** ${info.created_time || 'Không rõ'}
🎂 **Sinh nhật:** ${info.birthday}
👫 **Giới tính:** ${info.gender === 'male' ? 'Nam' : info.gender === 'female' ? 'Nữ' : 'Không rõ'}

❤️ **Tình trạng:** ${info.relationship_status}
💑 **Người yêu:** ${info.love}

📍 **Đến từ:** ${info.hometown}
🏠 **Sống tại:** ${info.location}

💼 **Công việc:**
${workInfo}

📝 **Giới thiệu:** ${info.about}
💬 **Quote:** ${info.quotes}

👥 **Follower:** ${info.follower}
✅ **Xác minh:** ${info.is_verified ? '✅ Có' : '❌ Không'}

🌐 **Website:** ${info.website || 'Không có'}

━━━━━━━━━━━━━━━━━━━━
🔹 Bot by @lemoneeese
  `;
}

// Xử lý /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, getMainMenuText(userId), { 
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(userId)
  });
});

// Xử lý callback
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  await bot.answerCallbackQuery(callbackQuery.id);

  // Xử lý chuyển token (động)
  if (action.startsWith('switch_to_')) {
    if (!isAdmin(userId)) return;
    
    const index = parseInt(action.split('_')[2]);
    const tokenList = getTokens();
    if (index >= 0 && index < tokenList.length) {
      global.currentTokenIndex = index;
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ Đã chuyển sang token ${index + 1}`,
        show_alert: true
      });
      await bot.editMessageText(`
✅ **Đã chuyển token thành công!**

Token mới: \`${tokenList[index].substring(0, 20)}...\`

Bot sẽ sử dụng token này cho các yêu cầu tiếp theo.
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại quản lý token', callback_data: 'admin_token' }]
          ]
        }
      });
    }
    return;
  }

  // Xử lý xóa token (động)
  if (action.startsWith('remove_')) {
    if (!isAdmin(userId)) return;
    
    const index = parseInt(action.split('_')[1]);
    const tokenArray = getTokens();
    if (index >= 0 && index < tokenArray.length) {
      const tokenToRemove = tokenArray[index];
      const result = removeToken(tokenToRemove, userId);
      
      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '✅ Đã xóa token thành công!',
          show_alert: true
        });
        await bot.editMessageText(`
✅ **Đã xóa token thành công!**

Token đã được xóa khỏi danh sách.
Còn ${getTokens().length} token trong hệ thống.
        `, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Quay lại quản lý token', callback_data: 'admin_token' }]
            ]
          }
        });
      } else {
        await bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    }
    return;
  }

  // Xử lý các action cố định
  switch (action) {
    case 'search':
      await bot.editMessageText(`
🔍 **Chế độ tra cứu**

Vui lòng gửi cho tôi:
• **UID Facebook** (dãy số)
• **Link Facebook** (https://facebook.com/...)

Ví dụ: 
\`1000123456789\`
hoặc
\`https://facebook.com/zuck\`

⏳ Tôi sẽ trả về thông tin chi tiết của tài khoản đó.

🔄 Nhấn nút bên dưới để quay lại.
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại', callback_data: 'back_main' }]
          ]
        }
      });
      setUserState(chatId, userId, 'waiting_uid');
      break;

    case 'download_media':
  await bot.editMessageText(
`⬇️ **TẢI MEDIA ĐA NỀN TẢNG**

Gửi liên kết **video, ảnh, âm thanh, bài viết hoặc sticker** từ một trong các nền tảng dưới đây. Bot sẽ tự động nhận diện URL và tải media nếu API hỗ trợ.

### 📋 Danh sách nền tảng hỗ trợ

1. Facebook
2. YouTube
3. TikTok
4. Douyin
5. SoundCloud
6. CapCut
7. Threads
8. ESPN
9. IMDb
10. Imgur
11. iFunny
12. Izlesene
13. Reddit
14. X (Twitter)
15. Vimeo
16. Snapchat
17. Bilibili
18. Dailymotion
19. ShareChat
20. Likee
21. LinkedIn
22. Tumblr
23. Hipi
24. Telegram
25. GetStickerPack
26. BitChute
27. Febspot
28. 9GAG
29. OKE.RU
30. Rumble
31. Streamable
32. TED
33. Sohu TV
34. XVideos
35. XNXX
36. Xiaohongshu (XHS)
37. Ixigua
38. Weibo
39. Sina Video
40. Mixcloud
41. Bandcamp
42. Spotify
43. Zing MP3
44. Instagram
45. Kuaishou
46. Pinterest
47. Miaopai
48. Meipai
49. Xiaoying
50. National Video
51. Yingke
52. Kwai
53. Akıllı TV
54. Blogger
55. BluTV
56. BuzzFeed
57. Chingari
58. Flickr
59. Gaana
60. MX TakaTak
61. Periscope
62. PuhuTV
63. VK
64. Twitch
65. Memedroid

### 📥 Ví dụ

• https://www.tiktok.com/...

> **Lưu ý:** Khả năng tải phụ thuộc vào API của từng nền tảng. Một số nội dung riêng tư, giới hạn độ tuổi hoặc được bảo vệ bản quyền có thể không hỗ trợ tải xuống.
`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Quay lại', callback_data: 'back_main' }]
        ]
      }
    }
  );
  setUserState(chatId, userId, 'waiting_download');
  break;

    case 'admin_token':
      if (!isAdmin(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Bạn không có quyền truy cập!',
          show_alert: true
        });
        return;
      }

      const tokens = getTokens();
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      
      const tokenStatus = tokens.length > 0 ? `✅ Đã có ${tokens.length} token` : '❌ Chưa có token';
      const tokenDisplay = tokens.length > 0 
        ? `📝 **Token đang dùng:** \`${getToken().substring(0, 20)}...\`` 
        : '📝 **Token:** Chưa có';
      
      let updateInfo = '';
      if (tokens.length > 0) {
        updateInfo = `
📅 **Cập nhật:** ${config.lastUpdated || 'Chưa có'}
👤 **Bởi:** ${config.updatedBy || 'Không rõ'}`;
      } else {
        updateInfo = `
📅 **Cập nhật:** Chưa có
👤 **Bởi:** Chưa có`;
      }
      
      await bot.editMessageText(`
⚙️ **QUẢN LÝ TOKEN**

🔑 **Trạng thái:** ${tokenStatus}
${tokenDisplay}${updateInfo}

📌 **Chọn chức năng:**
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminTokenKeyboard()
      });
      break;

    case 'list_tokens':
      if (!isAdmin(userId)) return;
      
      const allTokens = getTokens();
      let tokenListText = '📋 **DANH SÁCH TOKEN**\n\n';
      if (allTokens.length === 0) {
        tokenListText += 'Chưa có token nào!';
      } else {
        allTokens.forEach((token, index) => {
          const isCurrent = token === getToken();
          tokenListText += `${index + 1}. \`${token.substring(0, 15)}...\` ${isCurrent ? '✅ (Đang dùng)' : ''}\n`;
        });
        tokenListText += `\n📊 Tổng: ${allTokens.length} token`;
      }
      
      await bot.sendMessage(chatId, tokenListText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại quản lý token', callback_data: 'admin_token' }]
          ]
        }
      });
      break;

    case 'view_current_token':
      if (!isAdmin(userId)) return;
      const currentToken = getToken();
      if (!currentToken) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Chưa có token!',
          show_alert: true
        });
        return;
      }
      
      await bot.sendMessage(chatId, `
🔑 **TOKEN ĐANG DÙNG**

\`${currentToken}\`

📌 **Lưu ý:** Đây là token nhạy cảm, không chia sẻ với người khác!
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại quản lý token', callback_data: 'admin_token' }]
          ]
        }
      });
      break;

    case 'switch_token':
      if (!isAdmin(userId)) return;
      
      const switchTokens = getTokens();
      if (switchTokens.length <= 1) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Cần ít nhất 2 token để chuyển đổi!',
          show_alert: true
        });
        return;
      }
      
      const switchKeyboard = {
        inline_keyboard: switchTokens.map((token, index) => {
          const isCurrent = token === getToken();
          return [{
            text: `${index + 1}. ${token.substring(0, 15)}... ${isCurrent ? '✅' : ''}`,
            callback_data: `switch_to_${index}`
          }];
        })
      };
      switchKeyboard.inline_keyboard.push([
        { text: '🔙 Quay lại', callback_data: 'admin_token' }
      ]);
      
      await bot.editMessageText(`
🔄 **CHUYỂN ĐỔI TOKEN**

Chọn token bạn muốn sử dụng:
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: switchKeyboard
      });
      break;

    case 'add_token':
      if (!isAdmin(userId)) return;
      
      setUserState(chatId, userId, 'waiting_add_token');
      await bot.editMessageText(`
➕ **THÊM TOKEN MỚI**

Vui lòng gửi token mới cho tôi.

🔑 **Hướng dẫn:**
1. Lấy token từ Facebook Graph API
2. Gửi token vào chat này
3. Token sẽ được thêm vào danh sách

📌 **Lưu ý:** 
• Token phải có độ dài tối thiểu 10 ký tự
• Không thêm token trùng lặp

🔄 Nhấn nút bên dưới để hủy.
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Hủy', callback_data: 'admin_token' }]
          ]
        }
      });
      break;

    case 'remove_token':
      if (!isAdmin(userId)) return;
      
      const removeTokens = getTokens();
      if (removeTokens.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Chưa có token để xóa!',
          show_alert: true
        });
        return;
      }
      
      const removeKeyboard = {
        inline_keyboard: removeTokens.map((token, index) => {
          const isCurrent = token === getToken();
          return [{
            text: `${index + 1}. ${token.substring(0, 15)}... ${isCurrent ? '✅' : ''}`,
            callback_data: `remove_${index}`
          }];
        })
      };
      removeKeyboard.inline_keyboard.push([
        { text: '🔙 Quay lại', callback_data: 'admin_token' }
      ]);
      
      await bot.editMessageText(`
🗑️ **XÓA TOKEN**

Chọn token bạn muốn xóa:

⚠️ **Lưu ý:** Không thể khôi phục token đã xóa!
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: removeKeyboard
      });
      break;

    case 'help':
      await bot.editMessageText(`
📋 **HƯỚNG DẪN SỬ DỤNG**

🤖 **Bot này giúp bạn tra cứu thông tin Facebook**

**Cách sử dụng:**
1️⃣ Nhấn nút "🔍 Tra cứu Facebook"
2️⃣ Gửi UID hoặc link Facebook
3️⃣ Nhận kết quả chi tiết

**Các loại ID hỗ trợ:**
• UID số: \`1000123456789\`
• Link cá nhân: \`https://facebook.com/username\`
• Link ID: \`https://facebook.com/profile.php?id=1000123456789\`

**Thông tin nhận được:**
• Tên, UID, Username
• Ngày tạo tài khoản
• Sinh nhật, giới tính
• Tình trạng hôn nhân
• Nơi ở, quê quán
• Công việc
• Số lượng follower
• Và nhiều thông tin khác

${isAdmin(userId) ? `
**🔧 Quyền Admin:**
• Quản lý nhiều token Facebook API
• Xem/Thêm/Xóa/Chuyển đổi token
• Tự động chuyển token khi token die
` : ''}

💡 **Lưu ý:** Một số thông tin có thể bị ẩn do cài đặt riêng tư của người dùng.
      `, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại', callback_data: 'back_main' }]
          ]
        }
      });
      break;

    case 'back_main':
  await bot.editMessageText(getMainMenuText(userId), {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(userId)
  });
  clearUserState(chatId, userId);
  break;
  }
});

// Xử lý tin nhắn
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  if (!text || text.startsWith('/')) return;

  const state = getUserState(chatId, userId);
  if (!state) {
  await bot.sendMessage(chatId, getMainMenuText(userId), {
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(userId)
  });
  return;
}

  if (state === 'waiting_download') {
  const handled = await handleDownloader(bot, msg);
  if (!handled) {
    await bot.sendMessage(chatId, '❌ Vui lòng gửi một link hợp lệ từ nền tảng được hỗ trợ.');
  }
  return;
}

  // Xử lý thêm token
  if (state === 'waiting_add_token' && isAdmin(userId)) {
    const token = text.trim();
    
    if (token.length < 10) {
      await bot.sendMessage(chatId, '❌ Token không hợp lệ! Token phải có độ dài tối thiểu 10 ký tự.');
      return;
    }
    
    const result = addToken(token, userId);
    
    if (result.success) {
      await bot.sendMessage(chatId, `
✅ **Thêm token thành công!**

🔑 Token mới đã được thêm vào danh sách.
📊 Hiện có ${getTokenCount()} token trong hệ thống.
📅 Thời gian: ${new Date().toLocaleString('vi-VN')}

Bot đã sẵn sàng để sử dụng!
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Quay lại quản lý token', callback_data: 'admin_token' }]
          ]
        }
      });
      clearUserState(chatId, userId);
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
    return;
  }

  // Xử lý tra cứu
  if (state === 'waiting_uid') {
    const processingMsg = await bot.sendMessage(chatId, '⏳ Đang lấy thông tin... Vui lòng đợi!');

    try {
      let uid = text.trim();
      
      if (text.includes('facebook.com') || text.includes('fb.com')) {
  const idMatch = text.match(/[?&]id=(\d+)/);
  if (idMatch) {
    uid = idMatch[1];
  } else {
    const usernameMatch = text.match(/(?:facebook\.com\/|fb\.com\/)([^/?#]+)/);
    if (usernameMatch) {
      uid = usernameMatch[1];
    }
  }
}

      const token = getToken();
      if (!token) {
        await bot.sendMessage(chatId, `
❌ **Token chưa được cấu hình!**

Vui lòng liên hệ admin để thêm token.
        `, { parse_mode: 'Markdown' });
        await bot.deleteMessage(chatId, processingMsg.message_id);
        return;
      }

      const info = await getFacebookInfo(uid);
      const formattedInfo = formatUserInfo(info);
      
      await bot.sendMessage(chatId, formattedInfo, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      await bot.sendPhoto(chatId, info.avatar, {
        caption: `🖼️ Avatar của ${info.name}`,
        parse_mode: 'Markdown'
      });

      await bot.sendMessage(chatId, '🔍 Tiếp tục tra cứu hoặc quay lại menu:', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔍 Tra cứu tiếp', callback_data: 'search' },
              { text: '🏠 Menu chính', callback_data: 'back_main' }
            ]
          ]
        }
      });

    } catch (error) {
      let errorMessage = '❌ Đã xảy ra lỗi!';
      if (error.message === 'TOKEN_EMPTY') {
        errorMessage = '❌ Token chưa được cấu hình! Vui lòng liên hệ admin.';
      } else if (error.message === 'TOKEN_INVALID') {
        errorMessage = '❌ Tất cả token đều không hợp lệ hoặc đã hết hạn! Vui lòng cập nhật token mới.';
      } else if (error.message === 'USER_NOT_FOUND') {
        errorMessage = '❌ Không tìm thấy người dùng! Vui lòng kiểm tra lại UID.';
      } else if (error.message === 'PROFILE_PRIVATE') {
        errorMessage = '❌ Profile này đang ở chế độ riêng tư!';
      } else {
        errorMessage = `❌ Lỗi: ${error.message || 'Unknown error'}`;
      }
      
      await bot.sendMessage(chatId, errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔍 Thử lại', callback_data: 'search' },
              { text: '🏠 Menu chính', callback_data: 'back_main' }
            ]
          ]
        }
      });
    }
    await bot.deleteMessage(chatId, processingMsg.message_id);
  }
});

// Thêm route HTTP cho Uptime Robot (giữ bot không bị ngủ) ( nếu không up lên render thì xóa code này)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Bot is running!');
});

app.get('/ping', (req, res) => {
  res.send('🏓 Pong!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server đang chạy trên port ${PORT}`);
});

console.log('🤖 Bot đã khởi động thành công!');
console.log(`📱 Admin ID: ${ADMIN_ID}`);
console.log(`🔑 Số lượng token: ${getTokenCount()}`);
console.log(`📝 Token đang dùng: ${getToken() ? 'Có' : 'Chưa có'}`);
console.log('✅ Bot đã sẵn sàng!');