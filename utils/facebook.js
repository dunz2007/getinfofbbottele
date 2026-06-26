const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

// TOKEN CỐ ĐỊNH CHO AVATAR - KHÔNG BAO GIỜ DIE
const AVATAR_TOKEN = '2712477385668128|b429aeb53369951d411e1cae8e810640';

// Biến lưu token đang dùng và chỉ số hiện tại
let currentTokenIndex = 0;

function getTokens() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.tokens || [];
  } catch (error) {
    return [];
  }
}

function getToken() {
  const tokens = getTokens();
  if (tokens.length === 0) return '';
  
  // Đảm bảo currentTokenIndex hợp lệ
  if (currentTokenIndex >= tokens.length) {
    currentTokenIndex = 0;
  }
  
  return tokens[currentTokenIndex] || '';
}

function getNextToken() {
  const tokens = getTokens();
  if (tokens.length === 0) return '';
  
  // Chuyển sang token tiếp theo
  currentTokenIndex = (currentTokenIndex + 1) % tokens.length;
  return tokens[currentTokenIndex];
}

function saveTokens(tokens, userId) {
  try {
    const config = {
      tokens: tokens,
      lastUpdated: new Date().toISOString(),
      updatedBy: userId
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    // Reset index khi thay đổi tokens
    currentTokenIndex = 0;
    return true;
  } catch (error) {
    return false;
  }
}

function addToken(token, userId) {
  const tokens = getTokens();
  // Kiểm tra token đã tồn tại chưa
  if (tokens.includes(token)) {
    return { success: false, message: 'Token đã tồn tại!' };
  }
  tokens.push(token);
  const success = saveTokens(tokens, userId);
  return { success, message: success ? 'Thêm token thành công!' : 'Lỗi khi thêm token!' };
}

function removeToken(token, userId) {
  let tokens = getTokens();
  const index = tokens.indexOf(token);
  if (index === -1) {
    return { success: false, message: 'Không tìm thấy token!' };
  }
  tokens.splice(index, 1);
  const success = saveTokens(tokens, userId);
  return { success, message: success ? 'Xóa token thành công!' : 'Lỗi khi xóa token!' };
}

function getTokenCount() {
  return getTokens().length;
}

function convertTime(time) {
  if (!time) return null;
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

async function getFacebookInfo(uid, retryCount = 0) {
  const token = getToken();
  
  if (!token) {
    throw new Error('TOKEN_EMPTY');
  }

  const url = `https://graph.facebook.com/v1.0/${uid}`;
  const params = {
    fields: 'id,is_verified,cover,created_time,work,hometown,username,link,name,locale,location,about,website,birthday,gender,relationship_status,significant_other,quotes,first_name,subscribers.limit(0)',
    access_token: token
  };

  try {
    const response = await axios.get(url, {
      params: params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 15000
    });

    const data = response.data;

    // Kiểm tra lỗi từ Facebook
    if (data.error) {
      const errorCode = data.error.code;
      const errorMsg = data.error.message;
      
      // Nếu token die (lỗi 10, 190, 200) và còn token khác
      if ((errorCode === 10 || errorCode === 190 || errorCode === 200) && retryCount < getTokenCount() - 1) {
        console.log(`⚠️ Token die, chuyển sang token khác... (Lần thử: ${retryCount + 1})`);
        const nextToken = getNextToken();
        if (nextToken) {
          return await getFacebookInfo(uid, retryCount + 1);
        }
      }
      
      if (errorCode === 100) {
        throw new Error('PROFILE_NOT_FOUND');
      } else if (errorCode === 803) {
        throw new Error('PROFILE_DELETED');
      } else if (errorCode === 21) {
        throw new Error('PAGE_DELETED');
      } else if (errorCode === 10) {
        throw new Error('TOKEN_INVALID');
      } else {
        throw new Error(`FACEBOOK_ERROR: ${errorMsg}`);
      }
    }

    if (!data || !data.id) {
      throw new Error('USER_NOT_FOUND');
    }

    // Kiểm tra profile có public không
    if (!data.name && !data.first_name) {
      throw new Error('PROFILE_PRIVATE');
    }

    return {
      name: data.name || 'Không có tên',
      link_profile: data.link || `https://facebook.com/${data.id}`,
      uid: data.id,
      first_name: data.first_name || 'Không có',
      username: data.username || 'Không có',
      created_time: convertTime(data.created_time),
      website: data.website || 'Không có dữ liệu',
      gender: data.gender || 'Không có dữ liệu',
      relationship_status: data.relationship_status || 'Không có dữ liệu',
      love: data.significant_other?.name || 'Không có',
      birthday: data.birthday || 'Đang ẩn',
      follower: data.subscribers?.summary?.total_count || 0,
      is_verified: data.is_verified || false,
      avatar: `https://graph.facebook.com/${data.id}/picture?width=1500&height=1500&access_token=${AVATAR_TOKEN}`,
      quotes: data.quotes || 'Không có dữ liệu',
      about: data.about || 'Không có dữ liệu',
      locale: data.locale || 'Không có dữ liệu',
      location: data.location?.name || 'Không có dữ liệu',
      hometown: data.hometown?.name || 'Không có dữ liệu',
      cover: data.cover?.source || 'Không có ảnh bìa',
      work: data.work || []
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('TIMEOUT');
    }
    if (error.response) {
      const status = error.response.status;
      if ((status === 400 || status === 401) && retryCount < getTokenCount() - 1) {
        console.log(`⚠️ Token lỗi (status ${status}), chuyển sang token khác...`);
        const nextToken = getNextToken();
        if (nextToken) {
          return await getFacebookInfo(uid, retryCount + 1);
        }
      } else if (status === 403) {
        throw new Error('PERMISSION_DENIED');
      } else if (status === 404) {
        throw new Error('PROFILE_NOT_FOUND');
      }
    }
    throw error;
  }
}

module.exports = {
  getToken,
  getTokens,
  getNextToken,
  saveTokens,
  addToken,
  removeToken,
  getTokenCount,
  getFacebookInfo
};