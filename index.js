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
    message: 'Fixed Toonstream API - Anti-Block Measures',
    endpoints: {
      episode: '/api/anime/:name/:season/:episode',
      search: '/api/search/:query',
      example: '/api/anime/naruto-shippuden/1/1'
    }
  });
});

// Generate random user agent
const getRandomUserAgent = () => {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

// -------- FIXED TOONSTREAM ENDPOINT --------
app.get('/api/anime/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  try {
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episodeNum}/`;

    console.log('Trying to scrape:', toonstreamUrl);

    // Method 1: Try with enhanced headers first
    let response;
    try {
      response = await axios.get(toonstreamUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
          'Referer': 'https://toonstream.love/',
          'DNT': '1'
        }
      });
    } catch (error) {
      // If Method 1 fails, try alternative sources
      console.log('Method 1 failed, trying alternative sources...');
      return await tryAlternativeSources(name, season, episodeNum, res);
    }

    const $ = cheerio.load(response.data);

    // Check if we got blocked
    if ($('title').text().includes('403') || $('body').text().includes('Forbidden')) {
      console.log('Block detected, trying alternative sources...');
      return await tryAlternativeSources(name, season, episodeNum, res);
    }

    // Extract data
    const title = $('h1.entry-title').text().trim() || 
                  `${name.replace(/-/g, ' ')} Episode ${episodeNum}`;

    const description = $('.entry-content p').first().text().trim() || '';

    const thumbnail = $('.entry-content img, .post-thumbnail img').first().attr('src') || '';

    // Extract embed servers
    const embedServers = [];

    // Method 1: Direct iframes
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        const fullUrl = src.startsWith('//') ? 'https:' + src : src;
        embedServers.push({
          name: `Server ${embedServers.length + 1}`,
          url: fullUrl,
          type: 'iframe'
        });
      }
    });

    // Method 2: Look for embedded video scripts
    $('script').each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent) {
        // Common video embedding patterns
        const urlPatterns = [
          /src:\s*["']([^"']+)["']/g,
          /url:\s*["']([^"']+)["']/g,
          /file:\s*["']([^"']+)["']/g,
          /embed_url:\s*["']([^"']+)["']/g,
          /["'](https:\/\/[^"']*\.(mp4|m3u8)[^"']*)["']/gi
        ];

        urlPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(scriptContent)) !== null) {
            const url = match[1];
            if (url && !url.includes('google') && !url.includes('facebook')) {
              embedServers.push({
                name: `Embed ${embedServers.length + 1}`,
                url: url.startsWith('//') ? 'https:' + url : url,
                type: 'javascript'
              });
            }
          }
        });
      }
    });

    // Remove duplicates
    const uniqueServers = embedServers.filter((server, index, self) =>
      index === self.findIndex(s => s.url === server.url)
    );

    if (uniqueServers.length === 0) {
      return await tryAlternativeSources(name, season, episodeNum, res);
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
    console.error('Final error:', err.message);
    res.status(500).json({
      success: false,
      error: 'All scraping methods failed',
      message: 'Toonstream is blocking our requests. Try again later or use alternative sources.'
    });
  }
});

// -------- ALTERNATIVE SOURCES --------
async function tryAlternativeSources(name, season, episodeNum, res) {
  console.log('Trying alternative sources...');
  
  const alternativeSources = [
    {
      name: 'anime-world',
      url: `https://watchanimeworld.in/episode/${name}-${season}x${episodeNum}/`
    },
    {
      name: 'anime-server',
      url: `https://animeserver.com/episode/${name}-${season}-${episodeNum}/`
    }
    // Add more alternative sources here
  ];

  for (const source of alternativeSources) {
    try {
      console.log(`Trying ${source.name}: ${source.url}`);
      
      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Referer': 'https://google.com/'
        }
      });

      const $ = cheerio.load(response.data);
      const embedServers = [];

      // Extract servers from alternative source
      $('iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
          embedServers.push({
            name: `${source.name} Server ${i + 1}`,
            url: src.startsWith('//') ? 'https:' + src : src,
            type: 'iframe'
          });
        }
      });

      if (embedServers.length > 0) {
        return res.json({
          success: true,
          source: source.name,
          note: 'Data from alternative source (Toonstream blocked)',
          data: {
            anime_name: name,
            season: parseInt(season),
            episode: parseInt(episodeNum),
            title: `${name.replace(/-/g, ' ')} Episode ${episodeNum}`,
            episode_url: source.url,
            total_servers: embedServers.length,
            embed_servers: embedServers
          }
        });
      }
    } catch (error) {
      console.log(`${source.name} failed:`, error.message);
      continue;
    }
  }

  // If all alternatives fail, return mock data for testing
  return res.json({
    success: true,
    source: 'mock',
    note: 'Mock data - Toonstream and alternatives blocked',
    data: {
      anime_name: name,
      season: parseInt(season),
      episode: parseInt(episodeNum),
      title: `${name.replace(/-/g, ' ')} Episode ${episodeNum}`,
      total_servers: 3,
      embed_servers: [
        {
          name: "Server 1",
          url: "https://example.com/embed/test1",
          type: "iframe"
        },
        {
          name: "Server 2", 
          url: "https://example.com/embed/test2",
          type: "iframe"
        },
        {
          name: "Server 3",
          url: "https://example.com/embed/test3",
          type: "iframe"
        }
      ]
    }
  });
}

// -------- SIMPLIFIED SEARCH --------
app.get('/api/search/:query', async (req, res) => {
  const { query } = req.params;

  try {
    // Simple mock search for now
    const mockResults = [
      {
        title: `${query} - Anime`,
        url: `https://toonstream.love/${query}/`,
        image: ''
      }
    ];

    res.json({
      success: true,
      query,
      results: mockResults
    });

  } catch (error) {
    res.json({
      success: true,
      query,
      results: []
    });
  }
});

// -------- PROXY ENDPOINT (Bypass CORS) --------
app.get('/api/proxy/:url*', async (req, res) => {
  try {
    const url = req.params.url + (req.params[0] || '');
    const decodedUrl = decodeURIComponent(url);
    
    const response = await axios.get(decodedUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Referer': 'https://toonstream.love/'
      },
      responseType: 'arraybuffer'
    });

    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🛡️  Fixed Toonstream API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 Example: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
  });
}

module.exports = app;
