const express = require('express');
const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// YOUR EMBED URLs - তুমি এখানে তোমার এম্বেড URLs দিবে
const YOUR_EMBED_URLS = {
  // তোমার দেওয়া এম্বেড URLs এখানে রাখো
  'play.zephyrflick.top': 'https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406',
  'short.icu': 'https://short.icu/czoaptlRH',
  'cloudy.upns.one': 'https://cloudy.upns.one/#krllwg'
};

// -------- SIMPLE API - তোমার দেওয়া URLs ব্যবহার করবে --------
app.get('/api/anime/:name/:season/:episode', (req, res) => {
  const { name, season, episode } = req.params;

  try {
    // তোমার দেওয়া URLs থেকে server list তৈরি করো
    const servers = [
      {
        name: "Zephyr Server",
        url: YOUR_EMBED_URLS['play.zephyrflick.top'],
        domain: "play.zephyrflick.top"
      },
      {
        name: "Short ICU Server", 
        url: YOUR_EMBED_URLS['short.icu'],
        domain: "short.icu"
      },
      {
        name: "Cloudy Server",
        url: YOUR_EMBED_URLS['cloudy.upns.one'],
        domain: "cloudy.upns.one"
      }
    ];

    // Simple response
    res.json({
      success: true,
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episode),
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        servers: servers,
        total_servers: servers.length,
        note: 'Using your provided embed URLs'
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// -------- FULL SCREEN PLAYER --------
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
        body { background: #000; font-family: Arial; overflow: hidden; }
        .container { width: 100vw; height: 100vh; background: #000; }
        #videoPlayer { width: 100%; height: 100%; border: none; background: #000; }
        .server-buttons { 
            position: fixed; 
            bottom: 20px; 
            left: 50%; 
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            background: rgba(0,0,0,0.8);
            padding: 10px 20px;
            border-radius: 20px;
        }
        .server-btn { 
            padding: 8px 15px; 
            background: #333; 
            color: white; 
            border: none; 
            border-radius: 15px; 
            cursor: pointer; 
            font-size: 12px; 
        }
        .server-btn.active { background: #e50914; }
        .loading { 
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            color: white; 
            font-size: 18px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="loading" id="loading">Loading...</div>
        <iframe 
            id="videoPlayer"
            allowfullscreen
            webkitallowfullscreen
            mozallowfullscreen
        ></iframe>
        
        <div class="server-buttons" id="serverButtons">
            <!-- Server buttons will be added here -->
        </div>
    </div>

    <script>
        // Load episode data from API
        async function loadEpisode() {
            try {
                const response = await fetch('/api/anime/${name}/${season}/${episode}');
                const data = await response.json();
                
                if (data.success) {
                    initPlayer(data.data.servers);
                }
            } catch (error) {
                document.getElementById('loading').textContent = 'Failed to load';
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
            
            // Change iframe source to YOUR provided URL
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

// -------- UPDATE EMBED URLS (তুমি নতুন URLs add করতে পারবে) --------
app.get('/api/update-embeds', (req, res) => {
  const { domain, url } = req.query;
  
  if (domain && url) {
    YOUR_EMBED_URLS[domain] = url;
    res.json({
      success: true,
      message: 'Embed URL updated',
      domain: domain,
      url: url
    });
  } else {
    res.json({
      success: false,
      error: 'Missing domain or url parameter'
    });
  }
});

// -------- HEALTH CHECK --------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Your Embed URLs API - তোমার দেওয়া URLs ব্যবহার করে',
    endpoints: {
      api: '/api/anime/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      update: '/api/update-embeds?domain=DOMAIN&url=EMBED_URL',
      example: '/api/anime/naruto-shippuden/1/1'
    },
    your_embeds: YOUR_EMBED_URLS
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Your Embed URLs API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎮 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`📝 Your Embed URLs:`, YOUR_EMBED_URLS);
  });
}

module.exports = app;
