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

// -------- TOONSTREAM-STYLE API --------
app.get('/api/episode/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  try {
    console.log(`Finding servers for: ${name} S${season}E${episode}`);
    
    // Try multiple sources to find embed servers
    const sources = [
      {
        name: 'toonstream',
        url: `https://toonstream.love/episode/${name}-${season}x${episode}/`
      },
      {
        name: 'animeworld',
        url: `https://watchanimeworld.in/episode/${name}-${season}x${episode}/`
      }
    ];

    let foundServers = [];

    for (const source of sources) {
      try {
        console.log(`Checking: ${source.url}`);
        
        const response = await axios.get(source.url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);

        // Extract episode title
        const episodeTitle = $('h1.entry-title').text().trim() || 
                           `${name.replace(/-/g, ' ')} Episode ${episode}`;

        // Extract ALL iframe embeds
        $('iframe').each((i, el) => {
          let src = $(el).attr('src');
          if (src && src.includes('//')) {
            // Convert to full URL
            if (src.startsWith('//')) {
              src = 'https:' + src;
            }
            
            // Only add valid embed URLs
            if (src.startsWith('https://')) {
              foundServers.push({
                name: `Server ${foundServers.length + 1}`,
                url: src,
                type: 'embed'
              });
            }
          }
        });

        // If we found servers, also get episode info
        if (foundServers.length > 0) {
          console.log(`✅ Found ${foundServers.length} servers from ${source.name}`);
          
          res.json({
            success: true,
            episode_info: {
              anime_name: name,
              title: episodeTitle,
              season: parseInt(season),
              episode: parseInt(episode),
              source: source.name
            },
            servers: foundServers,
            total_servers: foundServers.length
          });
          return; // Stop here since we found servers
        }

      } catch (error) {
        console.log(`❌ ${source.name} failed:`, error.message);
        continue;
      }
    }

    // If no servers found from scraping, use mock servers for demo
    console.log('Using demo servers');
    const demoServers = [
      {
        name: "Server 1",
        url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
        type: "embed"
      },
      {
        name: "Server 2",
        url: "https://short.icu/czoaptlRH",
        type: "embed"
      },
      {
        name: "Server 3",
        url: "https://cloudy.upns.one/#krllwg", 
        type: "embed"
      }
    ];

    res.json({
      success: true,
      episode_info: {
        anime_name: name,
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        season: parseInt(season),
        episode: parseInt(episode),
        source: 'demo'
      },
      servers: demoServers,
      total_servers: demoServers.length
    });

  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get episode data'
    });
  }
});

// -------- TOONSTREAM-STYLE PLAYER PAGE --------
app.get('/watch/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  // Get episode data from our API
  let episodeData = {};
  try {
    const apiResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/episode/${name}/${season}/${episode}`);
    episodeData = apiResponse.data;
  } catch (error) {
    episodeData = {
      success: true,
      episode_info: {
        anime_name: name,
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        season: parseInt(season),
        episode: parseInt(episode)
      },
      servers: [
        {
          name: "Server 1",
          url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
          type: "embed"
        },
        {
          name: "Server 2",
          url: "https://short.icu/czoaptlRH", 
          type: "embed"
        },
        {
          name: "Server 3",
          url: "https://cloudy.upns.one/#krllwg",
          type: "embed"
        }
      ]
    };
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${episodeData.episode_info.title}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: #0a0a0a;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #fff;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .episode-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
            border-radius: 10px;
            border: 1px solid #333;
        }
        .episode-header h1 {
            font-size: 24px;
            margin-bottom: 5px;
            color: #fff;
            text-transform: capitalize;
        }
        .episode-header .meta {
            color: #ccc;
            font-size: 14px;
        }
        .video-container {
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .video-wrapper {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%;
            background: #000;
        }
        #videoPlayer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            background: #000;
        }
        .server-section {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #333;
        }
        .server-section h3 {
            margin-bottom: 15px;
            color: #fff;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .server-section h3:before {
            content: "🔗";
            font-size: 16px;
        }
        .server-list {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .server-btn {
            padding: 10px 20px;
            background: #333;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
            font-weight: 500;
            border: 2px solid transparent;
        }
        .server-btn:hover {
            background: #444;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .server-btn.active {
            background: #e50914;
            border-color: #ff4757;
            box-shadow: 0 4px 15px rgba(229, 9, 20, 0.3);
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #fff;
            font-size: 16px;
            text-align: center;
            background: rgba(0,0,0,0.8);
            padding: 20px 30px;
            border-radius: 10px;
            border: 1px solid #333;
        }
        .error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #e50914;
            text-align: center;
            background: rgba(0,0,0,0.9);
            padding: 30px;
            border-radius: 10px;
            border: 1px solid #e50914;
        }
        .current-server {
            margin-top: 15px;
            padding: 12px;
            background: #2a2a2a;
            border-radius: 6px;
            font-size: 14px;
            color: #ccc;
            border-left: 4px solid #e50914;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-top: 10px;
            font-size: 12px;
            color: #888;
        }
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            .server-list {
                justify-content: center;
            }
            .server-btn {
                padding: 8px 16px;
                font-size: 12px;
            }
            .episode-header h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="episode-header">
            <h1>${episodeData.episode_info.title}</h1>
            <div class="meta">
                Season ${season} • Episode ${episode} • ${episodeData.total_servers} Servers Available
            </div>
            <div class="stats">
                <span>Source: ${episodeData.episode_info.source}</span>
                <span>Anime: ${episodeData.episode_info.anime_name}</span>
            </div>
        </div>
        
        <div class="video-container">
            <div class="video-wrapper">
                <div class="loading" id="loading">🎬 Loading video player...</div>
                <div class="error" id="error" style="display: none;"></div>
                <iframe 
                    id="videoPlayer"
                    allowfullscreen
                    webkitallowfullscreen
                    mozallowfullscreen
                    scrolling="no"
                ></iframe>
            </div>
        </div>

        <div class="server-section">
            <h3>Available Servers</h3>
            <div class="server-list" id="serverList">
                <!-- Server buttons will be added here -->
            </div>
            <div class="current-server" id="currentServer">
                🔄 Select a server to start playing
            </div>
        </div>
    </div>

    <script>
        // Episode data from API
        const episodeData = ${JSON.stringify(episodeData)};
        let currentServerIndex = 0;

        // DOM elements
        const videoPlayer = document.getElementById('videoPlayer');
        const serverList = document.getElementById('serverList');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const currentServer = document.getElementById('currentServer');

        // Initialize the player
        function initPlayer() {
            console.log('Initializing player with', episodeData.servers.length, 'servers');
            
            // Create server buttons
            episodeData.servers.forEach((server, index) => {
                const button = document.createElement('button');
                button.className = 'server-btn';
                button.textContent = server.name;
                button.onclick = () => switchServer(index);
                serverList.appendChild(button);
            });
            
            // Auto-play first server
            if (episodeData.servers.length > 0) {
                setTimeout(() => switchServer(0), 1000);
            }
        }

        // Switch to different server
        function switchServer(index) {
            const server = episodeData.servers[index];
            console.log('Switching to server:', server.name, server.url);
            
            // Update active button
            document.querySelectorAll('.server-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
            
            // Update current server display
            currentServer.innerHTML = \`▶️ Now Playing: <strong>\${server.name}</strong> - \${server.url}\`;
            
            // Show loading
            loading.style.display = 'block';
            error.style.display = 'none';
            videoPlayer.style.display = 'none';
            
            // Change iframe source
            videoPlayer.src = server.url;
            
            // Handle load events
            videoPlayer.onload = function() {
                console.log('Server loaded successfully:', server.name);
                loading.style.display = 'none';
                videoPlayer.style.display = 'block';
                currentServer.innerHTML = \`✅ Now Playing: <strong>\${server.name}</strong>\`;
            };
            
            videoPlayer.onerror = function() {
                console.error('Server failed to load:', server.name);
                loading.style.display = 'none';
                error.style.display = 'block';
                error.innerHTML = \`
                    ❌ <strong>Server Error</strong><br>
                    Failed to load \${server.name}<br>
                    <small>Please try another server</small>
                \`;
                currentServer.innerHTML = \`❌ Failed: <strong>\${server.name}</strong> - Try another server\`;
            };
            
            currentServerIndex = index;
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Number keys 1-9 for servers
            if (e.key >= '1' && e.key <= '9') {
                const serverIndex = parseInt(e.key) - 1;
                if (serverIndex < episodeData.servers.length) {
                    switchServer(serverIndex);
                }
            }
        });

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initPlayer);

        // Log available servers for debugging
        console.log('Available servers:', episodeData.servers);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// -------- DIRECT EMBED (For iframe use) --------
app.get('/embed/:name/:season/:episode/:serverIndex?', async (req, res) => {
  const { name, season, episode, serverIndex = 0 } = req.params;

  try {
    const apiResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/episode/${name}/${season}/${episode}`);
    const servers = apiResponse.data.servers;
    const selectedServer = servers[parseInt(serverIndex)] || servers[0];

    res.json({
      embed_url: selectedServer.url,
      server_name: selectedServer.name,
      anime: name,
      season: season,
      episode: episode
    });

  } catch (error) {
    res.json({
      embed_url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
      server_name: "Default Server",
      anime: name,
      season: season,
      episode: episode
    });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎬 ToonStream-Style API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🎯 Watch Page: http://localhost:${PORT}/watch/naruto-shippuden/1/1`);
    console.log(`🔗 API: http://localhost:${PORT}/api/episode/naruto-shippuden/1/1`);
    console.log(`📺 Embed: http://localhost:${PORT}/embed/naruto-shippuden/1/1`);
  });
}

module.exports = app;
