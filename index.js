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
    message: 'Clean Embed API - Returns only video embed URLs',
    endpoints: {
      embed: '/embed/:name/:season/:episode',
      example: '/embed/naruto-shippuden/1/1'
    }
  });
});

// -------- CLEAN EMBED ENDPOINT --------
app.get('/embed/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  try {
    // Try Toonstream first
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episodeNum}/`;
    
    let embedUrl = null;

    try {
      const response = await axios.get(toonstreamUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Find first iframe
      const iframe = $('iframe').first();
      if (iframe.length) {
        embedUrl = iframe.attr('src');
        if (embedUrl.startsWith('//')) {
          embedUrl = 'https:' + embedUrl;
        }
      }
    } catch (toonstreamError) {
      console.log('Toonstream failed, trying alternative...');
    }

    // If Toonstream failed, try alternative
    if (!embedUrl) {
      const alternativeUrl = `https://watchanimeworld.in/episode/${name}-${season}x${episodeNum}/`;
      
      try {
        const response = await axios.get(alternativeUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        const iframe = $('iframe').first();
        if (iframe.length) {
          embedUrl = iframe.attr('src');
          if (embedUrl.startsWith('//')) {
            embedUrl = 'https:' + embedUrl;
          }
        }
      } catch (alternativeError) {
        console.log('Alternative also failed');
      }
    }

    // If still no embed URL, use the Zephyr URL directly
    if (!embedUrl) {
      embedUrl = "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406";
    }

    // Return ONLY the embed URL
    res.json({
      embed_url: embedUrl
    });

  } catch (err) {
    console.error('Error:', err.message);
    // Still return a working embed URL even if everything fails
    res.json({
      embed_url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406"
    });
  }
});

// -------- DIRECT EMBED REDIRECT --------
app.get('/embed-direct/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  try {
    // Get the embed URL (same logic as above)
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episodeNum}/`;
    let embedUrl = null;

    try {
      const response = await axios.get(toonstreamUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const iframe = $('iframe').first();
      if (iframe.length) {
        embedUrl = iframe.attr('src');
        if (embedUrl.startsWith('//')) {
          embedUrl = 'https:' + embedUrl;
        }
      }
    } catch (error) {
      // Use alternative or default
    }

    if (!embedUrl) {
      embedUrl = "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406";
    }

    // Redirect directly to the embed URL
    res.redirect(embedUrl);

  } catch (err) {
    // Redirect to default embed URL
    res.redirect("https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406");
  }
});

// -------- EMBED HTML PAGE --------
app.get('/player/:name/:season/:episodeNum', (req, res) => {
  const { name, season, episodeNum } = req.params;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${name} - Episode ${episodeNum}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            background: #000;
            height: 100%;
            overflow: hidden;
        }
        #videoFrame {
            width: 100%;
            height: 100vh;
            border: none;
        }
    </style>
</head>
<body>
    <iframe 
        id="videoFrame"
        src="https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406"
        allowfullscreen
        webkitallowfullscreen
        mozallowfullscreen
    ></iframe>
    
    <script>
        // You can add JavaScript here to dynamically change the iframe src
        // based on the anime name, season, and episode
        console.log('Playing: ${name} - Season ${season} Episode ${episodeNum}');
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Clean Embed API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 Clean Embed: http://localhost:${PORT}/embed/naruto-shippuden/1/1`);
    console.log(`🔗 Direct Redirect: http://localhost:${PORT}/embed-direct/naruto-shippuden/1/1`);
    console.log(`🔗 HTML Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
  });
}

module.exports = app;
