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

// Your target domains for embed search
const TARGET_DOMAINS = [
  'play.zephyrflick.top',
  'short.icu', 
  'cloudy.upns.one'
];

// -------- ORIGINAL API STRUCTURE (YOUR STYLE) --------
app.get('/api/anime/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  try {
    console.log(`🔍 Finding embeds for: ${name} S${season}E${episode}`);
    
    // Try Toonstream first to find embed links
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episode}/`;
    
    let foundServers = [];

    try {
      const response = await axios.get(toonstreamUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Extract episode title
      const episodeTitle = $('h1.entry-title').text().trim() || `${name.replace(/-/g, ' ')} Episode ${episode}`;

      // Find ALL iframes and check if they match our target domains
      $('iframe').each((index, element) => {
        const iframe = $(element);
        const src = iframe.attr('src');
        const dataSrc = iframe.attr('data-src');
        
        const embedUrl = dataSrc || src;
        
        if (embedUrl) {
          // Check if this embed URL matches any of our target domains
          const matchedDomain = TARGET_DOMAINS.find(domain => 
            embedUrl.includes(domain)
          );

          if (matchedDomain) {
            console.log(`✅ Found embed from ${matchedDomain}`);
            
            let finalUrl = embedUrl;
            if (embedUrl.startsWith('//')) {
              finalUrl = 'https:' + embedUrl;
            }

            foundServers.push({
              name: `Server ${foundServers.length + 1}`,
              url: finalUrl,
              type: 'iframe',
              domain: matchedDomain
            });
          }
        }
      });

    } catch (toonstreamError) {
      console.log('Toonstream failed, using direct servers');
    }

    // If no servers found from scraping, use direct server URLs
    if (foundServers.length === 0) {
      console.log('Using direct server URLs');
      foundServers = [
        {
          name: "Zephyr Server",
          url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
          type: "direct",
          domain: "play.zephyrflick.top"
        },
        {
          name: "Short ICU Server", 
          url: "https://short.icu/czoaptlRH",
          type: "direct",
          domain: "short.icu"
        },
        {
          name: "Cloudy Server",
          url: "https://cloudy.upns.one/#krllwg",
          type: "direct",
          domain: "cloudy.upns.one"
        }
      ];
    }

    // Simple response - just like your original
    res.json({
      success: true,
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episode),
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        servers: foundServers,
        total_servers: foundServers.length
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch episode'
    });
  }
});

// -------- SIMPLE PLAYER (Like your original) --------
app.get('/player/:name/:season/:episode', (req, res) => {
  const { name, season, episode } = req.params;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${name} - Episode ${episode}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; font-family: Arial; color: white; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .video-container { background: #111; border-radius: 8px; overflow: hidden; margin-bottom: 15px; }
        .video-wrapper { position: relative; width: 100%; padding-bottom: 56.25%; }
        #videoPlayer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        .server-buttons { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .server-btn { padding: 8px 15px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .server-btn.active { background: #e50914; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; }
        .episode-info { text-align: center; margin-bottom: 15px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <div class="episode-info">
            <h2>${name.replace(/-/g, ' ')} - Season ${season} Episode ${episode}</h2>
        </div>
        
        <div class="video-container">
            <div class="video-wrapper">
                <div class="loading" id="loading">Select a server</div>
                <iframe 
                    id="videoPlayer"
                    allowfullscreen
                    webkitallowfullscreen
                    mozallowfullscreen
                ></iframe>
            </div>
        </div>

        <div class="server-buttons" id="serverButtons">
            <!-- Server buttons will be added here -->
        </div>
    </div>

    <script>
        // Get data from API
        async function loadEpisode() {
            try {
                const response = await fetch('/api/anime/${name}/${season}/${episode}');
                const data = await response.json();
                
                if (data.success) {
                    initPlayer(data.data.servers);
                }
            } catch (error) {
                console.error('Failed to load episode:', error);
            }
        }

        function initPlayer(servers) {
            const serverButtons = document.getElementById('serverButtons');
            const videoPlayer = document.getElementById('videoPlayer');
            const loading = document.getElementById('loading');
            
            // Create server buttons
            servers.forEach((server, index) => {
                const button = document.createElement('button');
                button.className = 'server-btn';
                button.textContent = server.name;
                button.onclick = () => switchServer(server.url, index);
                serverButtons.appendChild(button);
            });
            
            // Auto-play first server
            if (servers.length > 0) {
                switchServer(servers[0].url, 0);
            }
        }

        function switchServer(url, index) {
            // Update active button
            document.querySelectorAll('.server-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
            
            // Show loading
            document.getElementById('loading').style.display = 'block';
            videoPlayer.style.display = 'none';
            
            // Change iframe source
            videoPlayer.src = url;
            
            // Hide loading when loaded
            videoPlayer.onload = function() {
                document.getElementById('loading').style.display = 'none';
                videoPlayer.style.display = 'block';
            };
        }

        // Load episode when page opens
        loadEpisode();
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// -------- HEALTH CHECK --------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Simple Anime API - Original Structure',
    endpoints: {
      api: '/api/anime/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      example: '/api/anime/naruto-shippuden/1/1'
    },
    target_domains: TARGET_DOMAINS
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Simple Anime API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎮 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`🎯 Target Domains: ${TARGET_DOMAINS.join(', ')}`);
  });
}

module.exports = app;
