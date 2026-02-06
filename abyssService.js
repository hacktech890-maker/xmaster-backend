const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class AbyssService {
  constructor() {
    this.apiKey = process.env.ABYSS_API_KEY;
    this.apiBaseUrl = process.env.ABYSS_API_BASE_URL || 'https://api.abyss.to';
    this.uploadBaseUrl = 'https://up.abyss.to';
    
    if (!this.apiKey) {
      console.error('ABYSS_API_KEY is not set in environment variables');
    }
  }

  // Upload video file to Abyss.to
  async uploadVideo(filePath, fileName) {
    try {
      console.log('Uploading video to Abyss.to:', fileName);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), fileName);

      const uploadUrl = `${this.uploadBaseUrl}/${this.apiKey}`;

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/related'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 600000 // 10 minutes for large files
      });

      if (response.data && response.data.slug) {
        console.log('Upload successful, file ID:', response.data.slug);
        
        // Get file info to retrieve full details
        const fileInfo = await this.getFileInfo(response.data.slug);
        
        return {
          file_id: response.data.slug,
          name: fileInfo.name || fileName,
          size: fileInfo.size || 0,
          status: fileInfo.status || 'waiting'
        };
      } else {
        throw new Error('Upload failed: Invalid response from Abyss.to');
      }
    } catch (error) {
      console.error('Error uploading video to Abyss.to:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  // Get file information from Abyss.to
  async getFileInfo(fileId) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/v1/files/${fileId}`, {
        params: {
          key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file info from Abyss.to:', error.message);
      // Return minimal info if API call fails
      return {
        id: fileId,
        name: 'Unknown',
        size: 0,
        status: 'unknown'
      };
    }
  }

  // Get all files (for listing)
  async getAllFiles(options = {}) {
    try {
      const params = {
        key: this.apiKey,
        maxResults: options.maxResults || 25,
        orderBy: options.orderBy || 'createdAt:desc',
        type: 'files'
      };

      if (options.pageToken) {
        params.pageToken = options.pageToken;
      }

      const response = await axios.get(`${this.apiBaseUrl}/v1/resources`, {
        params: params
      });

      return response.data;
    } catch (error) {
      console.error('Error getting files from Abyss.to:', error.message);
      throw error;
    }
  }

  // Delete video from Abyss.to
  async deleteVideo(fileId) {
    try {
      await axios.delete(`${this.apiBaseUrl}/v1/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      console.log('Video deleted from Abyss.to:', fileId);
      return true;
    } catch (error) {
      console.error('Error deleting video from Abyss.to:', error.message);
      throw error;
    }
  }

  // Generate embed URL for video
  getEmbedUrl(fileId, options = {}) {
    // Abyss.to embed format
    // Based on domainEmbed from resources response
    const domain = options.domain || 'abyss.to';
    return `https://${domain}/embed/${fileId}`;
  }

  // Generate thumbnail URL for video
  getThumbnailUrl(fileId, options = {}) {
    // Abyss.to thumbnail format (if available)
    // Note: May need to be adjusted based on actual Abyss.to thumbnail URLs
    const domain = options.domain || 'abyss.to';
    return `https://${domain}/thumb/${fileId}.jpg`;
  }

  // Update file name
  async updateFileName(fileId, newName) {
    try {
      const response = await axios.put(
        `${this.apiBaseUrl}/v1/files/${fileId}`,
        { name: newName },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating file name:', error.message);
      throw error;
    }
  }

  // Upload subtitle
  async uploadSubtitle(fileId, subtitleFile, language, filename) {
    try {
      const response = await axios.put(
        `${this.apiBaseUrl}/v1/upload/subtitles/${fileId}`,
        fs.readFileSync(subtitleFile),
        {
          params: {
            language: language,
            filename: filename
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/octet-stream'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading subtitle:', error.message);
      throw error;
    }
  }

  // Check API health and quota
  async getQuotaInfo() {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/v1/about`, {
        params: {
          key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting quota info:', error.message);
      return null;
    }
  }
}

module.exports = new AbyssService();
