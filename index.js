const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Toonstream.love Scraping API',
    endpoints: {
      episode: '/api/anime/:name/:season/:episode',
      search: '/api/search/:query',
      example: '/api/anime/naruto-shippuden/1/1'
    }
  });
});

// -------- TOONSTREAM.LOVE SCRAPING ENDPOINT --------
app.get('/api/anime/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  try {
    // Construct Toonstream episode URL
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episodeNum}/`;

    console.log('Scraping Toonstream:', toonstreamUrl);

    const response = await axios.get(toonstreamUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://toonstream.love/',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    const $ = cheerio.load(response.data);

    // Extract episode title
    const title = $('h1.entry-title').text().trim() || 
                  `${name.replace(/-/g, ' ')} Episode ${episodeNum}`;

    // Extract description
    const description = $('.entry-content p').first().text().trim() || '';

    // Extract thumbnail
    const thumbnail = $('.entry-content img, .post-thumbnail img').first().attr('src') || '';

    // Extract ALL embed servers from Toonstream
    const embedServers = [];

    // Method 1: Direct iframes (main method)
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && (src.includes('//') || src.startsWith('http'))) {
        const fullUrl = src.startsWith('//') ? 'https:' + src : src;
        embedServers.push({
          name: `Server ${embedServers.length + 1}`,
          url: fullUrl,
          type: 'iframe'
        });
      }
    });

    // Method 2: Video players
    $('video source').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('http')) {
        embedServers.push({
          name: `Video Server ${embedServers.length + 1}`,
          url: src,
          type: 'direct'
        });
      }
    });

    // Method 3: JavaScript embedded players (common in Toonstream)
    $('script').each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent) {
        // Look for common video player patterns
        const patterns = [
          /src:\s*["']([^"']+)["']/g,
          /url:\s*["']([^"']+)["']/g,
          /file:\s*["']([^"']+)["']/g,
          /embed_url:\s*["']([^"']+)["']/g,
          /["'](https:\/\/[^"']*\.(mp4|m3u8|webm)[^"']*)["']/g
        ];

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(scriptContent)) !== null) {
            const url = match[1];
            if (url && url.includes('//')) {
              const fullUrl = url.startsWith('//') ? 'https:' + url : url;
              embedServers.push({
                name: `JS Server ${embedServers.length + 1}`,
                url: fullUrl,
                type: 'javascript'
              });
            }
          }
        });
      }
    });

    // Method 4: Data attributes
    $('[data-src], [data-url], [data-file]').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('data-url') || $(el).attr('data-file');
      if (src && src.includes('//')) {
        const fullUrl = src.startsWith('//') ? 'https:' + src : src;
        embedServers.push({
          name: `Data Server ${embedServers.length + 1}`,
          url: fullUrl,
          type: 'data'
        });
      }
    });

    // Remove duplicate servers
    const uniqueServers = embedServers.filter((server, index, self) =>
      index === self.findIndex(s => s.url === server.url)
    );

    if (uniqueServers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No embed servers found on Toonstream',
        url: toonstreamUrl
      });
    }

    // Success response
    res.json({
      success: true,
      source: 'toonstream.love',
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episodeNum),
        title,
        description,
        thumbnail,
        episode_url: toonstreamUrl,
        total_servers: uniqueServers.length,
        embed_servers: uniqueServers
      }
    });

  } catch (err) {
    console.error('Toonstream Scraping Error:', err.message);

    if (err.response && err.response.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found on Toonstream',
        message: 'The episode URL returned 404 Not Found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to scrape Toonstream',
      message: err.message
    });
  }
});

// -------- SEARCH TOONSTREAM --------
app.get('/api/search/:query', async (req, res) => {
  const { query } = req.params;

  try {
    const searchUrl = `https://toonstream.love/?s=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Extract search results
    $('article').each((i, el) => {
      const title = $(el).find('h2.entry-title a').text().trim();
      const url = $(el).find('h2.entry-title a').attr('href');
      const image = $(el).find('img').attr('src');
      const description = $(el).find('.entry-content p').text().trim();

      if (title && url) {
        results.push({
          title,
          url,
          image: image || '',
          description: description || ''
        });
      }
    });

    res.json({
      success: true,
      source: 'toonstream.love',
      query,
      results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// -------- GET ANIME INFO --------
app.get('/api/anime-info/:name', async (req, res) => {
  const { name } = req.params;

  try {
    // Try to find anime main page
    const animeUrl = `https://toonstream.love/${name}/`;

    const response = await axios.get(animeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    const title = $('h1.entry-title').text().trim();
    const description = $('.entry-content p').first().text().trim();
    const thumbnail = $('.post-thumbnail img, .entry-content img').first().attr('src');

    // Extract episode list
    const episodes = [];
    $('a[href*="/episode/"]').each((i, el) => {
      const episodeUrl = $(el).attr('href');
      const episodeText = $(el).text().trim();
      
      episodes.push({
        title: episodeText,
        url: episodeUrl
      });
    });

    res.json({
      success: true,
      data: {
        anime_name: name,
        title,
        description,
        thumbnail,
        total_episodes: episodes.length,
        episodes: episodes.slice(0, 20) // Limit to first 20 episodes
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get anime info',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎌 Toonstream Scraping API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 Example: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎯 Directly scraping: https://toonstream.love/`);
  });
}

module.exports = app;
