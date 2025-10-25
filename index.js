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
    message: 'Multi-Server Embed API with Server Switching',
    endpoints: {
      embed: '/embed/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      example: '/player/naruto-shippuden/1/1'
    }
  });
});

// -------- MULTI-SERVER EMBED API --------
app.get('/embed/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  try {
    // Try to get actual servers from Toonstream or alternative
    let servers = [];
    
    try {
      const alternativeUrl = `https://watchanimeworld.in/episode/${name}-${season}x${episodeNum}/`;
      const response = await axios.get(alternativeUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Extract all iframes
      $('iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
          servers.push({
            name: `Server ${i + 1}`,
            url: src.startsWith('//') ? 'https:' + src : src,
            type: 'iframe'
          });
        }
      });
    } catch (scrapeError) {
      console.log('Scraping failed, using default servers');
    }

    // If no servers found from scraping, use default servers
    if (servers.length === 0) {
      servers = [
        {
          name: "Zephyr Server",
          url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
          type: "direct",
          quality: ["360p", "480p", "720p"]
        },
        {
          name: "Short ICU Server", 
          url: "https://short.icu/czoaptlRH",
          type: "iframe",
          quality: ["480p", "720p"]
        },
        {
          name: "Cloudy Server",
          url: "https://cloudy.upns.one/#krllwg",
          type: "iframe", 
          quality: ["360p", "720p"]
        }
      ];
    }

    res.json({
      success: true,
      anime_name: name,
      season: parseInt(season),
      episode: parseInt(episodeNum),
      servers: servers
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch servers'
    });
  }
});

// -------- COMPLETE PLAYER WITH SERVER SWITCHING --------
app.get('/player/:name/:season/:episodeNum', async (req, res) => {
  const { name, season, episodeNum } = req.params;

  // Get server data
  let servers = [];
  try {
    const embedResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/embed/${name}/${season}/${episodeNum}`);
    servers = embedResponse.data.servers;
  } catch (error) {
    // Fallback servers
    servers = [
      {
        name: "Zephyr Server",
        url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
        type: "direct"
      },
      {
        name: "Short ICU Server", 
        url: "https://short.icu/czoaptlRH",
        type: "iframe"
      },
      {
        name: "Cloudy Server",
        url: "https://cloudy.upns.one/#krllwg",
        type: "iframe"
      }
    ];
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${name.replace(/-/g, ' ')} - Episode ${episodeNum}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: #0f0f0f;
            font-family: 'Arial', sans-serif;
            color: white;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .episode-info {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            background: #1a1a1a;
            border-radius: 10px;
        }
        .episode-info h1 {
            font-size: 28px;
            margin-bottom: 5px;
            color: #fff;
            text-transform: capitalize;
        }
        .episode-info .season-episode {
            color: #ccc;
            font-size: 16px;
        }
        .player-section {
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .video-container {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            height: 0;
        }
        #videoFrame {
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
        }
        .server-section h3 {
            margin-bottom: 15px;
            color: #fff;
            font-size: 18px;
        }
        .server-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .server-btn {
            padding: 12px 20px;
            background: #333;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
            font-weight: 500;
        }
        .server-btn:hover {
            background: #444;
            transform: translateY(-2px);
        }
        .server-btn.active {
            background: #e50914;
            box-shadow: 0 2px 10px rgba(229, 9, 20, 0.3);
        }
        .server-btn:disabled {
            background: #555;
            cursor: not-allowed;
            opacity: 0.6;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 18px;
            text-align: center;
        }
        .error-message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #e50914;
            text-align: center;
            font-size: 16px;
            background: rgba(0,0,0,0.8);
            padding: 20px;
            border-radius: 10px;
        }
        .quality-selector {
            margin-top: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .quality-btn {
            padding: 8px 15px;
            background: #333;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .quality-btn.active {
            background: #e50914;
        }
        .current-server {
            margin-top: 15px;
            padding: 10px;
            background: #2a2a2a;
            border-radius: 6px;
            font-size: 14px;
            color: #ccc;
        }
        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            .server-buttons {
                justify-content: center;
            }
            .server-btn {
                padding: 10px 15px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="episode-info">
            <h1>${name.replace(/-/g, ' ')}</h1>
            <div class="season-episode">Season ${season} • Episode ${episodeNum}</div>
        </div>
        
        <div class="player-section">
            <div class="video-container">
                <div class="loading" id="loading">Loading video player...</div>
                <div class="error-message" id="errorMessage" style="display: none;"></div>
                <iframe 
                    id="videoFrame"
                    allowfullscreen
                    webkitallowfullscreen
                    mozallowfullscreen
                    scrolling="no"
                ></iframe>
            </div>
        </div>

        <div class="server-section">
            <div class="controls">
                <h3>Available Servers</h3>
                <div class="current-server" id="currentServer">
                    Current: Loading...
                </div>
            </div>
            
            <div class="server-buttons" id="serverButtons">
                <!-- Server buttons will be loaded here -->
            </div>
        </div>
    </div>

    <script>
        // Server data
        const servers = ${JSON.stringify(servers)};
        let currentServerIndex = 0;

        // DOM elements
        const videoFrame = document.getElementById('videoFrame');
        const serverButtons = document.getElementById('serverButtons');
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('errorMessage');
        const currentServerDisplay = document.getElementById('currentServer');

        // Initialize servers
        function initializeServers() {
            serverButtons.innerHTML = '';
            
            servers.forEach((server, index) => {
                const button = document.createElement('button');
                button.className = 'server-btn';
                button.textContent = server.name;
                button.onclick = () => switchServer(index);
                
                serverButtons.appendChild(button);
            });
            
            // Load first server
            if (servers.length > 0) {
                switchServer(0);
            }
        }

        // Switch server function
        function switchServer(index) {
            currentServerIndex = index;
            const server = servers[index];
            
            // Update active button
            document.querySelectorAll('.server-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
            
            // Update current server display
            currentServerDisplay.textContent = \`Current: \${server.name}\`;
            
            // Show loading
            loading.style.display = 'block';
            errorMessage.style.display = 'none';
            videoFrame.style.display = 'none';
            
            // Set iframe source
            videoFrame.src = server.url;
            
            // Handle iframe load
            videoFrame.onload = () => {
                loading.style.display = 'none';
                videoFrame.style.display = 'block';
            };
            
            // Handle iframe error
            videoFrame.onerror = () => {
                loading.style.display = 'none';
                errorMessage.style.display = 'block';
                errorMessage.innerHTML = \`
                    <strong>Server Error</strong><br>
                    Failed to load \${server.name}<br>
                    <small>Try another server</small>
                \`;
            };
        }

        // Check if server URLs are working
        function testServerUrls() {
            servers.forEach((server, index) => {
                const button = document.querySelectorAll('.server-btn')[index];
                
                // Simple test - if URL contains known working domains
                const workingDomains = ['zephyrflick.top', 'short.icu', 'cloudy.upns.one'];
                const isLikelyWorking = workingDomains.some(domain => server.url.includes(domain));
                
                if (!isLikelyWorking) {
                    button.style.opacity = '0.7';
                    button.title = 'This server might not work';
                }
            });
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeServers();
            setTimeout(testServerUrls, 1000);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Number keys 1-9 to switch servers
            if (e.key >= '1' && e.key <= '9') {
                const serverIndex = parseInt(e.key) - 1;
                if (serverIndex < servers.length) {
                    switchServer(serverIndex);
                }
            }
            
            // Space bar to play/pause (if video is focused)
            if (e.code === 'Space') {
                e.preventDefault();
                // You can add play/pause logic here if using video tag instead of iframe
            }
        });

        console.log('Available servers:', servers);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// -------- SIMPLE EMBED REDIRECT --------
app.get('/embed-direct/:name/:season/:episodeNum/:serverIndex?', async (req, res) => {
  const { name, season, episodeNum, serverIndex = 0 } = req.params;

  try {
    // Get server data
    const embedResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/embed/${name}/${season}/${episodeNum}`);
    const servers = embedResponse.data.servers;
    
    const selectedServer = servers[parseInt(serverIndex)] || servers[0];
    
    // Redirect to the embed URL
    res.redirect(selectedServer.url);

  } catch (error) {
    // Fallback to Zephyr server
    res.redirect("https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406");
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎮 Multi-Server Player running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🎯 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`🔗 Embed API: http://localhost:${PORT}/embed/naruto-shippuden/1/1`);
  });
}

module.exports = app;
