// In-memory database for video metadata
// In production, replace with MongoDB, PostgreSQL, etc.

class VideoDatabase {
  constructor() {
    this.videos = [];
    this.nextId = 1;
  }

  // Add a new video
  addVideo(videoData) {
    const video = {
      id: this.nextId++,
      file_code: videoData.file_code,
      title: videoData.title,
      thumbnail: videoData.thumbnail || `https://streamtape.com/thumb/${videoData.file_code}.jpg`,
      upload_date: new Date().toISOString(),
      views: 0,
      duration: videoData.duration || '0:00'
    };
    
    this.videos.unshift(video); // Add to beginning (newest first)
    return video;
  }

  // Get all videos
  getAllVideos() {
    return this.videos;
  }

  // Get video by ID
  getVideoById(id) {
    return this.videos.find(video => video.id === parseInt(id));
  }

  // Get video by file_code
  getVideoByFileCode(fileCode) {
    return this.videos.find(video => video.file_code === fileCode);
  }

  // Update video views
  incrementViews(id) {
    const video = this.getVideoById(id);
    if (video) {
      video.views++;
      return video;
    }
    return null;
  }

  // Delete video
  deleteVideo(id) {
    const index = this.videos.findIndex(video => video.id === parseInt(id));
    if (index !== -1) {
      return this.videos.splice(index, 1)[0];
    }
    return null;
  }

  // Seed with sample data for testing
  seedData() {
    // Add sample videos (these are example file codes)
    const sampleVideos = [
      {
        file_code: 'sample_code_1',
        title: 'Sample Video 1 - Introduction',
        duration: '5:30'
      },
      {
        file_code: 'sample_code_2',
        title: 'Sample Video 2 - Tutorial',
        duration: '12:45'
      },
      {
        file_code: 'sample_code_3',
        title: 'Sample Video 3 - Advanced Concepts',
        duration: '8:20'
      }
    ];

    sampleVideos.forEach(video => this.addVideo(video));
  }
}

module.exports = new VideoDatabase();
