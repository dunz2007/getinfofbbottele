const axios = require("axios");
const fs = require("fs");
const path = require("path");

const APIKEY = process.env.DOWNALL_APIKEY || "dungkon_0tf82";
const CACHE_DIR = path.join(__dirname, "..", "cache");

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
  else if (/xhslink\.com/.test(url)) platform = "XIAOHONGSHU";
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

async function streamURL(url, ext) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000
  });

  const filePath = path.join(
    CACHE_DIR,
    `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  );

  fs.writeFileSync(filePath, res.data);

  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }, 60 * 1000);

  return filePath;
}

async function fetchMediaData(url) {
  try {
    const apiURL = `http://dungkon.lol/dowall?url=${encodeURIComponent(url)}&apikey=${APIKEY}`;
    const { data } = await axios.get(apiURL, { timeout: 45000 });

    if (
      !data ||
      data.status !== true ||
      !data.data ||
      !Array.isArray(data.data.medias) ||
      data.data.medias.length === 0
    ) return null;

    const mediaData = data.data;
    const medias = mediaData.medias;

    const mp4Media = medias.filter(m => m.type === "video" && m.extension === "mp4");
    const imageMedia = medias.filter(m => m.type === "image");
    const audioMedia = medias.filter(m => m.type === "audio" && m.extension === "mp3");

    const author = mediaData.author || "N/A";
    const title = mediaData.title || "Unknown";
    const source = mediaData.source || "unknown";

    let stats = "";
    if (mediaData.statistics) {
      const s = mediaData.statistics;
      stats = `\n👍 ${s.digg_count || s.like_count || 0} | 💬 ${s.comment_count || 0} | 🔄 ${s.share_count || 0}`;
    }

    const caption =
`👤 Tên Kênh: ${author}
📝 Tiêu Đề: ${title}
📱 Nền tảng: ${source.toUpperCase()}${stats}
──────────────────
📺 Tính năng tải đa nền tảng.`;

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
          path: await streamURL(selectedVideo.url, "mp4")
        });
      }
    }

    for (const img of imageMedia) {
      if (img.url) {
        files.push({
          type: "image",
          ext: "jpg",
          path: await streamURL(img.url, "jpg")
        });
      }
    }

    for (const audio of audioMedia) {
      if (audio.url) {
        files.push({
          type: "audio",
          ext: "mp3",
          path: await streamURL(audio.url, "mp3")
        });
      }
    }

    if (files.length === 0) return null;

    return { title, caption, files };
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
  const result = await fetchMediaData(url);

  if (!result) {
    await bot.editMessageText("❌ Không tải được media từ link này.", {
      chat_id: chatId,
      message_id: loading.message_id
    });
    return true;
  }

  await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

  const mainCaption = `[ ${platform} ] - Download\n\n${result.caption}`;
  const cleanTitle = sanitizeFileName(result.title || platform);

  // Gom tất cả ảnh thành album
const images = result.files.filter(f => f.type === "image");
const others = result.files.filter(f => f.type !== "image");

if (images.length > 1) {
    for (let i = 0; i < images.length; i += 10) {
        const chunk = images.slice(i, i + 10);

        await bot.sendMediaGroup(
            chatId,
            chunk.map((file, index) => ({
                type: "photo",
                media: fs.createReadStream(file.path),
                caption: i === 0 && index === 0 ? mainCaption : undefined
            }))
        );
    }
} else if (images.length === 1) {
    await bot.sendPhoto(
        chatId,
        fs.createReadStream(images[0].path),
        { caption: mainCaption }
    );
}

// gửi video/audio sau
for (const file of others) {
    if (file.type === "video") {
        await bot.sendVideo(chatId, fs.createReadStream(file.path));
    } else if (file.type === "audio") {
        await bot.sendDocument(
            chatId,
            fs.createReadStream(file.path),
            {
                filename: `${cleanTitle}.mp3`
            }
        );
    }
}

  return true;
}

module.exports = {
  handleDownloader
};