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

// তোমার指定的 domains - এগুলো থেকে auto embed খুঁজবে
const TARGET_DOMAINS = [
  'play.zephyrflick.top',
  'short.icu', 
  'cloudy.upns.one'
];

// -------- AUTO EMBED FINDER API --------
app.get('/api/anime/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  try {
    console.log(`🔍 Auto searching: ${name} S${season}E${episode}`);
    
    // Toonstream episode page
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episode}/`;
    
    let foundServers = [];

    try {
      console.log(`📡 Fetching: ${toonstreamUrl}`);
      
      const response = await axios.get(toonstreamUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://toonstream.love/'
        }
      });

      const $ = cheerio.load(response.data);

      // Episode info
      const episodeTitle = $('h1.entry-title').text().trim() || `${name.replace(/-/g, ' ')} Episode ${episode}`;
      const thumbnail = $('.post-thumbnail img, .entry-content img').first().attr('src') || '';

      // Auto find embeds from target domains
      console.log(`🎯 Searching for: ${TARGET_DOMAINS.join(', ')}`);
      
      $('iframe').each((index, element) => {
        const iframe = $(element);
        const src = iframe.attr('src') || iframe.attr('data-src');
        
        if (src) {
          TARGET_DOMAINS.forEach(domain => {
            if (src.includes(domain)) {
              console.log(`✅ Found: ${domain} - ${src}`);
              
              let finalUrl = src.startsWith('//') ? 'https:' + src : src;
              
              foundServers.push({
                name: `${domain} Server`,
                url: finalUrl,
                domain: domain,
                type: 'auto_found'
              });
            }
          });
        }
      });

    } catch (error) {
      console.log('❌ Toonstream fetch failed:', error.message);
    }

    // Remove duplicates
    const uniqueServers = foundServers.filter((server, index, self) =>
      index === self.findIndex(s => s.url === server.url)
    );

    console.log(`🎉 Auto found: ${uniqueServers.length} servers`);

    res.json({
      success: true,
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episode),
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        servers: uniqueServers,
        total_servers: uniqueServers.length,
        source: 'auto_toonstream'
      }
    });

  } catch (err) {
    console.error('💥 API Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Auto search failed'
    });
  }
});

// -------- AUTO PLAYER --------
app.get('/player/:name/:season/:episode', (req, res) => {
  const { name, season, episode } = req.params;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${name.replace(/-/g, ' ')} - Episode ${episode}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; font-family: Arial; color: white; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px; }
        .header h1 { font-size: 22px; margin-bottom: 5px; }
        .auto-info { color: #0af; font-size: 12px; margin-top: 5px; }
        .video-container { background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
        .video-wrapper { position: relative; width: 100%; padding-bottom: 56.25%; }
        #videoPlayer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; background: #000; }
        .servers { background: #1a1a1a; padding: 15px; border-radius: 8px; }
        .servers h3 { margin-bottom: 10px; }
        .server-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .server-btn { padding: 8px 12px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .server-btn.active { background: #e50914; }
        .server-domain { font-size: 10px; color: #0af; display: block; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; background: rgba(0,0,0,0.8); padding: 20px; border-radius: 8px; }
        .current { margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px; font-size: 12px; }
        .search-status { margin-top: 15px; padding: 10px; background: #333; border-radius: 4px; font-size: 11px; color: #0af; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${name.replace(/-/g, ' ')} - Season ${season} Episode ${episode}</h1>
            <div class="auto-info">
                🔍 Auto Searching: play.zephyrflick.top, short.icu, cloudy.upns.one
            </div>
        </div>
        
        <div class="video-container">
            <div class="video-wrapper">
                <div class="loading" id="loading">🔄 Auto searching for embed servers...</div>
                <iframe 
                    id="videoPlayer"
                    allowfullscreen
                    webkitallowfullscreen
                    mozallowfullscreen
                    scrolling="no"
                ></iframe>
            </div>
        </div>

        <div class="servers">
            <h3>Auto Found Servers</h3>
            <div class="server-buttons" id="serverButtons">
                <!-- Auto found servers will appear here -->
            </div>
            <div class="current" id="currentServer">
                🔍 Searching for embed servers...
            </div>
            <div class="search-status" id="searchStatus">
                <strong>Auto Search Status:</strong> Fetching from Toonstream...
            </div>
        </div>
    </div>

    <script>
        // Auto load episode data
        async function loadEpisode() {
            const loading = document.getElementById('loading');
            const searchStatus = document.getElementById('searchStatus');
            const currentServer = document.getElementById('currentServer');
            
            try {
                searchStatus.innerHTML = '<strong>Auto Search Status:</strong> Fetching from Toonstream...';
                
                const response = await fetch('/api/anime/${name}/${season}/${episode}');
                const data = await response.json();
                
                if (data.success) {
                    searchStatus.innerHTML = '<strong>Auto Search Status:</strong> ✅ Found ' + data.data.total_servers + ' servers';
                    initPlayer(data.data.servers);
                } else {
                    loading.textContent = '❌ No servers found';
                    searchStatus.innerHTML = '<strong>Auto Search Status:</strong> ❌ No servers found';
                }
            } catch (error) {
                loading.textContent = '❌ API Error';
                searchStatus.innerHTML = '<strong>Auto Search Status:</strong> ❌ Failed to fetch';
                console.error('Load error:', error);
            }
        }

        function initPlayer(servers) {
            const serverButtons = document.getElementById('serverButtons');
            const videoPlayer = document.getElementById('videoPlayer');
            const loading = document.getElementById('loading');
            const currentServer = document.getElementById('currentServer');
            
            console.log('Auto found servers:', servers);
            
            // Clear previous buttons
            serverButtons.innerHTML = '';
            
            if (servers.length === 0) {
                loading.textContent = '❌ No embed servers found';
                currentServer.textContent = 'No servers available';
                return;
            }
            
            // Create server buttons from auto found servers
            servers.forEach((server, index) => {
                const btn = document.createElement('button');
                btn.className = 'server-btn';
                btn.innerHTML = \`
                    \${server.name}<br>
                    <span class="server-domain">\${server.domain}</span>
                \`;
                btn.onclick = () => switchServer(server.url, index, server.name);
                serverButtons.appendChild(btn);
            });
            
            // Auto play first server
            switchServer(servers[0].url, 0, servers[0].name);
        }

        function switchServer(url, index, serverName) {
            const videoPlayer = document.getElementById('videoPlayer');
            const loading = document.getElementById('loading');
            const currentServer = document.getElementById('currentServer');
            
            // Update active button
            document.querySelectorAll('.server-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
            
            currentServer.innerHTML = \`▶️ Now Playing: <strong>\${serverName}</strong>\`;
            
            // Show loading
            loading.style.display = 'block';
            loading.textContent = '🔄 Loading ' + serverName + '...';
            videoPlayer.style.display = 'none';
            
            // Change iframe source to auto found URL
            videoPlayer.src = url;
            
            // Handle load
            videoPlayer.onload = function() {
                loading.style.display = 'none';
                videoPlayer.style.display = 'block';
                currentServer.innerHTML = \`✅ Now Playing: <strong>\${serverName}</strong>\`;
            };
            
            videoPlayer.onerror = function() {
                loading.style.display = 'block';
                loading.innerHTML = \`❌ Failed to load: \${serverName}<br><small>Try another server</small>\`;
                currentServer.innerHTML = \`❌ Failed: <strong>\${serverName}</strong>\`;
            };
        }

        // Auto start when page loads
        document.addEventListener('DOMContentLoaded', loadEpisode);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// -------- BULK EPISODE FINDER --------
app.get('/api/bulk-find/:name/:season/:startEpisode/:endEpisode', async (req, res) => {
  const { name, season, startEpisode, endEpisode } = req.params;
  
  const results = [];
  
  for (let episode = parseInt(startEpisode); episode <= parseInt(endEpisode); episode++) {
    try {
      const apiUrl = `http://localhost:${process.env.PORT || 3000}/api/anime/${name}/${season}/${episode}`;
      const response = await axios.get(apiUrl);
      
      results.push({
        episode: episode,
        data: response.data
      });
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      results.push({
        episode: episode,
        error: error.message
      });
    }
  }
  
  res.json({
    success: true,
    anime: name,
    season: season,
    episodes_searched: `${startEpisode}-${endEpisode}`,
    results: results
  });
});

// -------- HEALTH CHECK --------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Auto Embed Finder API - Automatically finds embeds from Toonstream',
    endpoints: {
      api: '/api/anime/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      bulk_find: '/api/bulk-find/:name/:season/:startEpisode/:endEpisode',
      example: '/api/anime/naruto-shippuden/1/1'
    },
    auto_search: {
      domains: TARGET_DOMAINS,
      source: 'toonstream.love',
      method: 'Automatic embed extraction from page source'
    }
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Auto Embed Finder API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎮 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`🔍 Auto Searching: ${TARGET_DOMAINS.join(', ')}`);
    console.log(`🌐 Source: toonstream.love`);
  });
}

module.exports = app;
