const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const ABYSS_API_BASE = process.env.ABYSS_API_BASE_URL || 'https://api.abyss.to';
const ABYSS_API_KEY = process.env.ABYSS_API_KEY;

const abyssApi = axios.create({
  baseURL: ABYSS_API_BASE,
  timeout: 300000, // 5 minutes timeout for uploads
});

// Get Account Info
const getAccountInfo = async () => {
  try {
    const response = await abyssApi.get('/api/account/info', {
      params: { key: ABYSS_API_KEY }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Account Info Error:', error.response?.data || error.message);
    throw error;
  }
};

// Upload Video to Abyss.to
const uploadVideo = async (filePath, fileName) => {
  try {
    // First, get upload server
    const serverResponse = await abyssApi.get('/api/upload/server', {
      params: { key: ABYSS_API_KEY }
    });
    
    const uploadUrl = serverResponse.data.result;
    
    // Create form data
    const form = new FormData();
    form.append('key', ABYSS_API_KEY);
    form.append('file', fs.createReadStream(filePath), fileName);
    
    // Upload to server
    const uploadResponse = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 600000 // 10 minutes
    });
    
    return uploadResponse.data;
  } catch (error) {
    console.error('Abyss Upload Error:', error.response?.data || error.message);
    throw error;
  }
};

// Get Video Info
const getVideoInfo = async (fileCode) => {
  try {
    const response = await abyssApi.get('/api/file/info', {
      params: { 
        key: ABYSS_API_KEY,
        file_code: fileCode
      }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Video Info Error:', error.response?.data || error.message);
    throw error;
  }
};

// Get Multiple Videos Info
const getMultipleVideoInfo = async (fileCodes) => {
  try {
    const response = await abyssApi.get('/api/file/info', {
      params: { 
        key: ABYSS_API_KEY,
        file_code: fileCodes.join(',')
      }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Multiple Video Info Error:', error.response?.data || error.message);
    throw error;
  }
};

// Delete Video
const deleteVideo = async (fileCode) => {
  try {
    const response = await abyssApi.get('/api/file/delete', {
      params: { 
        key: ABYSS_API_KEY,
        file_code: fileCode
      }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Delete Error:', error.response?.data || error.message);
    throw error;
  }
};

// Get Embed URL
const getEmbedUrl = (fileCode) => {
  return `https://abyss.to/e/${fileCode}`;
};

// Get Thumbnail URL
const getThumbnailUrl = (fileCode) => {
  return `https://abyss.to/thumbs/${fileCode}.jpg`;
};

// Clone/Remote Upload
const remoteUpload = async (url) => {
  try {
    const response = await abyssApi.get('/api/upload/url', {
      params: { 
        key: ABYSS_API_KEY,
        url: url
      }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Remote Upload Error:', error.response?.data || error.message);
    throw error;
  }
};

// Check Remote Upload Status
const checkRemoteUploadStatus = async (fileCode) => {
  try {
    const response = await abyssApi.get('/api/upload/url/status', {
      params: { 
        key: ABYSS_API_KEY,
        file_code: fileCode
      }
    });
    return response.data;
  } catch (error) {
    console.error('Abyss Remote Status Error:', error.response?.data || error.message);
    throw error;
  }
};

// List Files
const listFiles = async (page = 1, perPage = 50, folderId = null) => {
  try {
    const params = { 
      key: ABYSS_API_KEY,
      page: page,
      per_page: perPage
    };
    if (folderId) params.fld_id = folderId;
    
    const response = await abyssApi.get('/api/file/list', { params });
    return response.data;
  } catch (error) {
    console.error('Abyss List Files Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  getAccountInfo,
  uploadVideo,
  getVideoInfo,
  getMultipleVideoInfo,
  deleteVideo,
  getEmbedUrl,
  getThumbnailUrl,
  remoteUpload,
  checkRemoteUploadStatus,
  listFiles
};