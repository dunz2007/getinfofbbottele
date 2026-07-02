const axios = require("axios");
const fs = require("fs");
const path = require("path");
const CACHE_DIR = path.join(__dirname, "..", "cache");

const TG_LIMITS = {
  CAPTION: 1024,
  MESSAGE: 4096,
  MEDIA_GROUP: 10,
  VIDEO_SIZE: 50 * 1024 * 1024,
  DOCUMENT_SIZE: 50 * 1024 * 1024
};

const pendingAudio = new Map();

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function isURL(u) {
  return /^https?:\/\//.test(u || "");
}

function sanitizeFileName(name = "Unknown") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Unknown";
}

function limitText(text = "", max = 1024) {
  text = String(text || "").trim();
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}



function extractURL(text) {
  if (typeof text !== "string") return null;
  const urls = text.match(/(https?:\/\/[^\s]+)/g);
  return urls ? urls[0] : null;
}

function detectPlatform(url) {
  let platform;

  if (/facebook\.com|fb\.watch/.test(url)) platform = "FACEBOOK";
  else if (/youtube\.com|youtu\.be/.test(url)) platform = "YOUTUBE";
  else if (/tiktok\.com\//.test(url)) platform = "TIKTOK";
  else if (/douyin\.com\//.test(url)) platform = "DOUYIN";
  else if (/soundcloud\.com|on\.soundcloud\.com/.test(url)) platform = "SOUNDCLOUD";
  else if (/capcut\.com\//.test(url)) platform = "CAPCUT";
  else if (/threads\.net/.test(url)) platform = "THREADS";
  else if (/espn\.com/.test(url)) platform = "ESPN";
  else if (/imdb\.com/.test(url)) platform = "IMDB";
  else if (/imgur\.com/.test(url)) platform = "IMGUR";
  else if (/ifunny\.co/.test(url)) platform = "IFUNNY";
  else if (/izlesene\.com/.test(url)) platform = "IZLESENE";
  else if (/reddit\.com/.test(url)) platform = "REDDIT";
  else if (/x\.com|twitter\.com/.test(url)) platform = "TWITTER | X";
  else if (/vimeo\.com/.test(url)) platform = "VIMEO";
  else if (/snapchat\.com/.test(url)) platform = "SNAPCHAT";
  else if (/bilibili\.com/.test(url)) platform = "BILIBILI";
  else if (/dailymotion\.com/.test(url)) platform = "DAILYMOTION";
  else if (/sharechat\.com/.test(url)) platform = "SHARECHAT";
  else if (/likee\.com/.test(url)) platform = "LIKEE";
  else if (/linkedin\.com/.test(url)) platform = "LINKEDIN";
  else if (/tumblr\.com/.test(url)) platform = "TUMBLR";
  else if (/hipi\.in/.test(url)) platform = "HIPI";
  else if (/telegram\.org/.test(url)) platform = "TELEGRAM";
  else if (/getstickerpack\.com/.test(url)) platform = "GETSTICKERPACK";
  else if (/bitchute\.com/.test(url)) platform = "BITCHUTE";
  else if (/febspot\.com/.test(url)) platform = "FEBSPOT";
  else if (/9gag\.com/.test(url)) platform = "9GAG";
  else if (/oke\.ru/.test(url)) platform = "OKE.RU";
  else if (/rumble\.com/.test(url)) platform = "RUMBLE";
  else if (/streamable\.com/.test(url)) platform = "STREAMABLE";
  else if (/ted\.com/.test(url)) platform = "TED";
  else if (/sohu\.com/.test(url)) platform = "SOHU.TV";
  else if (/xvideos\.com/.test(url)) platform = "XVIDEOS";
  else if (/xnxx\.com/.test(url)) platform = "XNXX";
  else if (/xiaohongshu\.com/.test(url)) platform = "XIAOHONGSHU";
  else if (/ixigua\.com/.test(url)) platform = "IXIGUA";
  else if (/weibo\.com/.test(url)) platform = "WEIBO";
  else if (/sina\.com/.test(url)) platform = "SINA";
  else if (/mixcloud\.com/.test(url)) platform = "MIXCLOUD";
  else if (/bandcamp\.com/.test(url)) platform = "BANDCAMP";
  else if (/spotify\.com/.test(url)) platform = "SPOTIFY";
  else if (/zingmp3\.vn/.test(url)) platform = "ZINGMP3";
  else if (/instagram\.com/.test(url)) platform = "INSTAGRAM";
  else if (/kuaishou\.com/.test(url)) platform = "KUAISHOU";
  else if (/pinterest\.com|pin\.it/.test(url)) platform = "PINTEREST";
  else if (/miaopai\.com/.test(url)) platform = "MIAOPAI";
  else if (/meipai\.com/.test(url)) platform = "MEIPAI";
  else if (/xiaoying\.com/.test(url)) platform = "XIAOYING";
  else if (/nationalvideo\.com/.test(url)) platform = "NATIONAL VIDEO";
  else if (/yingke\.com/.test(url)) platform = "YINGKE";
  else if (/kwai\.com/.test(url)) platform = "KWAI";
  else if (/akillitv\.com/.test(url)) platform = "AKILLI TV";
  else if (/blogger\.com/.test(url)) platform = "BLOGGER";
  else if (/blutv\.com/.test(url)) platform = "BLUTV";
  else if (/buzzfeed\.com/.test(url)) platform = "BUZZFEED";
  else if (/chingari\.com/.test(url)) platform = "CHINGARI";
  else if (/flickr\.com/.test(url)) platform = "FLICKR";
  else if (/gaana\.com/.test(url)) platform = "GAANA";
  else if (/mxtakatak\.com/.test(url)) platform = "MXTAKATAK";
  else if (/periscope\.tv/.test(url)) platform = "PERISCOPE";
  else if (/puhutv\.com/.test(url)) platform = "PUHUTV";
  else if (/vk\.com/.test(url)) platform = "VK";
  else if (/twitch\.tv/.test(url)) platform = "TWITCH";
  else if (/memedroid\.com/.test(url)) platform = "MEMEDROID";

  return platform;
}

async function streamURL(url, ext, filename = null) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000
  });

  const safeName = filename
  ? sanitizeFileName(filename)
  : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const filePath = path.join(
  CACHE_DIR,
  `${safeName}.${ext}`
);

  fs.writeFileSync(filePath, res.data);

  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }, 10 * 60 * 1000);

  return filePath;
}

async function fetchTikTokData(url) {
  try {
    const { data } = await axios({
      method: "post",
      url: "https://tikwm.com/api/",
      data: { url },
      headers: {
        "content-type": "application/json"
      },
      timeout: 45000
    });

    const json = data?.data;
    if (!json) return null;

    const title = json.title || "Unknown";
    const author = json.author?.nickname || json.author?.unique_id || "N/A";
    const files = [];

    if (Array.isArray(json.images) && json.images.length > 0) {
      const images = json.images.slice(0, TG_LIMITS.MEDIA_GROUP);

      for (let i = 0; i < images.length; i++) {
        files.push({
          type: "image",
          ext: "jpg",
          path: await streamURL(images[i], "jpg", `${title}_${i + 1}`)
        });
      }
    } else if (json.play) {
      files.push({
        type: "video",
        ext: "mp4",
        url: json.play,
        path: await streamURL(json.play, "mp4", title)
      });
    }

    if (json.music) {
      files.push({
        type: "audio",
        ext: "mp3",
        url: json.music,
        path: await streamURL(json.music, "mp3", json.music_info?.title || title)
      });
    }

    if (files.length === 0) return null;

    return {
      title,
      author,
      source: "TIKTOK",
      files
    };
  } catch (err) {
    console.error("fetchTikTokData error:", err.message);
    return null;
  }
}

async function fetchMediaData(url) {
  try {
    const apiURL = `https://subhatde.id.vn/downall?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiURL, { timeout: 45000 });

    const mediaData = data?.data?.medias ? data.data : data;

if (
  !mediaData ||
  !Array.isArray(mediaData.medias) ||
  mediaData.medias.length === 0
) return null;

const medias = mediaData.medias;

const mp4Media = medias.filter(
  m => String(m.type).toLowerCase() === "video"
);

const imageMedia = medias.filter(
  m => ["image", "photo"].includes(String(m.type).toLowerCase())
);

const audioMedia = medias.filter(
  m => String(m.type).toLowerCase() === "audio"
);

const author =
  typeof mediaData.author === "object"
    ? (mediaData.author.name || mediaData.author.username || "N/A")
    : (mediaData.author || "N/A");

const title = mediaData.title || "Unknown";
const source = mediaData.source || detectPlatform(url) || "unknown";

    const files = [];
    const isTikTokOrDouyin = /tiktok|douyin/.test(url);

    if (mp4Media.length > 0) {
      let selectedVideo;

      if (isTikTokOrDouyin) {
        selectedVideo = mp4Media.find(m =>
          m.quality === "hd_no_watermark" ||
          m.quality === "HD No Watermark"
        );
      }

      if (!selectedVideo) {
        selectedVideo = mp4Media.sort((a, b) =>
          String(b.quality || "").localeCompare(String(a.quality || ""))
        )[0];
      }

      if (selectedVideo?.url) {
        files.push({
          type: "video",
          ext: "mp4",
          url: selectedVideo.url,
          path: await streamURL(
  selectedVideo.url,
  "mp4",
  title
)
        });
      }
    }

    for (const img of imageMedia) {
      if (img.url) {
        files.push({
          type: "image",
          ext: "jpg",
          path: await streamURL(
  img.url,
  "jpg",
  `${title}_${files.length + 1}`
)
        });
      }
    }

    for (const audio of audioMedia) {
      if (audio.url) {
        files.push({
          type: "audio",
          ext: "mp3",
          url: audio.url,
          path: await streamURL(
  audio.url,
  "mp3",
  mediaData.music?.title || title
)
        });
      }
    }

    if (files.length === 0) return null;

    return {
  title,
  author,
  source: source.toUpperCase(),
  files
};
  } catch (err) {
    console.error("fetchMediaData error:", err.message);
    return null;
  }
}

async function handleDownloader(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || "";
  const url = extractURL(text);

  if (!isURL(url)) return false;

  const platform = detectPlatform(url);
  if (!platform) return false;

  const loading = await bot.sendMessage(chatId, `⏳ Đang tải ${platform}...`);
  const result =
  platform === "TIKTOK"
    ? await fetchTikTokData(url)
    : await fetchMediaData(url);

  if (!result) {
    await bot.editMessageText("❌ Không tải được media từ link này.", {
      chat_id: chatId,
      message_id: loading.message_id
    });
    return true;
  }

  await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

const cleanTitle = sanitizeFileName(result.title || platform);
const videoUrl = result.files.find(f => f.type === "video")?.url;

const caption =
`👤 Tên Kênh: ${result.author}
📝 Tiêu Đề: ${limitText(result.title, 700)}
📱 Nền tảng: ${result.source}
${videoUrl ? `🔗 Link tải:\n${videoUrl}\n` : ""}
──────────────────
📺 Tính năng tải đa nền tảng.`;

const audios = result.files.filter(f => f.type === "audio");
const audioKey = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const replyMarkup = audios.length
  ? {
      inline_keyboard: [
        [
          {
            text: "🎵 Tải MP3",
            callback_data: audioKey
          }
        ]
      ]
    }
  : undefined;
const images = result.files.filter(f => f.type === "image").slice(0, TG_LIMITS.MEDIA_GROUP);
const others = result.files.filter(f => f.type !== "image" && f.type !== "audio");

const isOnlyAudio = audios.length > 0 && images.length === 0 && others.length === 0;

const audioNote = audios.length > 0 && !isOnlyAudio
  ? `\n\n🎵 Có kèm file nhạc.\n👇 Nhấn nút bên dưới để tải MP3.`
  : "";

const mainCaption = limitText(
  `[ ${result.source} ] - Download\n\n${caption}${audioNote}`,
  TG_LIMITS.CAPTION
);

  // Gom tất cả ảnh thành album

if (images.length > 1) {
    for (let i = 0; i < images.length; i += 10) {
        const chunk = images.slice(i, i + 10);

        const sent = await bot.sendMediaGroup(
  chatId,
  chunk.map((file, index) => ({
    type: "photo",
    media: fs.createReadStream(file.path),
    caption: i === 0 && index === 0 ? mainCaption : undefined
  }))
);

if (i === 0 && audios.length > 0) {
  pendingAudio.set(audioKey,{
    chatId,
    file: audios[0],
    title: cleanTitle
  });
}
if (i === 0 && audios.length > 0) {
  await bot.sendMessage(chatId, "🎵 Có kèm file nhạc. Nhấn nút bên dưới để tải MP3.", {
    reply_to_message_id: sent[0].message_id,
    reply_markup: replyMarkup
  });
}
    }
} else if (images.length === 1) {
    const sent = await bot.sendPhoto(
        chatId,
        fs.createReadStream(images[0].path),
        { caption: mainCaption,
    reply_markup: replyMarkup }
    );
    if (audios.length > 0) {
  pendingAudio.set(audioKey,{
    chatId,
    file: audios[0],
    title: cleanTitle
  });
}
}

// Nếu chỉ có file audio (SoundCloud, Spotify...)
if (audios.length > 0 && images.length === 0 && others.length === 0) {
  const audio = audios[0];

  if (getFileSize(audio.path) > TG_LIMITS.DOCUMENT_SIZE) {
    await bot.sendMessage(chatId, "❌ File MP3 vượt quá giới hạn Telegram.");
    return true;
  }

  await bot.sendDocument(
    chatId,
    fs.createReadStream(audio.path),
    {
      caption: mainCaption,
      filename: `${cleanTitle}.mp3`
    }
  );

  return true;
}

// gửi video/audio sau
for (const file of others) {
    if (file.type === "video") {
      if (getFileSize(file.path) > TG_LIMITS.VIDEO_SIZE) {
  await bot.sendMessage(chatId, "❌ Video vượt quá giới hạn 50MB của Telegram Bot.");
  continue;
}
  const sent = await bot.sendVideo(
  chatId,
  fs.createReadStream(file.path),
  {
    caption: mainCaption,
    reply_markup: replyMarkup
  }
);

if (audios.length > 0) {
  pendingAudio.set(audioKey,{
    chatId,
    file: audios[0],
    title: cleanTitle
  });
}
}
}

  return true;
}

function setupAudioButton(bot) {
  bot.on("callback_query", async (query) => {
  try {
    if (!query.data.startsWith("audio_")) return;

    const pending = pendingAudio.get(query.data);

    if (!pending) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ File MP3 đã hết hạn.",
        show_alert: true
      });
    }

    await bot.answerCallbackQuery(query.id);

    if (getFileSize(pending.file.path) > TG_LIMITS.DOCUMENT_SIZE) {
      pendingAudio.delete(query.data);

      return bot.sendMessage(
        pending.chatId,
        "❌ File MP3 vượt quá giới hạn Telegram.",
        {
          reply_to_message_id: query.message.message_id
        }
      );
    }

    await bot.sendDocument(
      pending.chatId,
      fs.createReadStream(pending.file.path),
      {
        caption: "🎵 File MP3",
        filename: `${pending.title}.mp3`,
        reply_to_message_id: query.message.message_id
      }
    );

    pendingAudio.delete(query.data);

  } catch (e) {
    console.log(e);
  }
});
}

module.exports = {
    handleDownloader,
    setupAudioButton
};