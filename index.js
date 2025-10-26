const express = require('express');
const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// তোমার manually added embed URLs - এখানে তুমি যেকোনো এম্বেড URL add করবে
const MANUAL_EMBEDS = {
  'naruto-shippuden': {
    '1': {
      '1': [
        {
          name: "Zephyr Server",
          url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
          type: "embed"
        },
        {
          name: "Short ICU Server", 
          url: "https://short.icu/czoaptlRH",
          type: "embed"
        },
        {
          name: "Cloudy Server",
          url: "https://cloudy.upns.one/#krllwg",
          type: "embed"
        }
      ],
      '2': [
        {
          name: "Zephyr Server",
          url: "https://play.zephyrflick.top/video/another-episode-id",
          type: "embed"
        },
        {
          name: "Short ICU Server",
          url: "https://short.icu/another-code",
          type: "embed"
        }
      ]
    }
  },
  'one-piece': {
    '1': {
      '1': [
        {
          name: "Zephyr Server",
          url: "https://play.zephyrflick.top/video/one-piece-ep1",
          type: "embed"
        },
        {
          name: "Cloudy Server",
          url: "https://cloudy.upns.one/one-piece-1",
          type: "embed"
        }
      ]
    }
  }
};

// -------- SIMPLE API - তোমার দেওয়া এম্বেডগুলো return করবে --------
app.get('/api/anime/:name/:season/:episode', (req, res) => {
  const { name, season, episode } = req.params;

  try {
    // তোমার manually added embeds থেকে data নাও
    const servers = MANUAL_EMBEDS[name]?.[season]?.[episode];

    if (!servers || servers.length === 0) {
      return res.json({
        success: false,
        error: 'No servers found for this episode',
        note: 'Add embed URLs manually in the MANUAL_EMBEDS object'
      });
    }

    // Simple response - exactly like you want
    res.json({
      success: true,
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episode),
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        servers: servers,
        total_servers: servers.length
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

// -------- ADD NEW EMBED URL (তুমি নতুন এম্বেড add করতে পারবে) --------
app.get('/api/add-embed/:name/:season/:episode', (req, res) => {
  const { name, season, episode } = req.params;
  const { url, server_name = "Custom Server" } = req.query;

  if (!url) {
    return res.json({
      success: false,
      error: 'Missing embed URL'
    });
  }

  // Initialize if not exists
  if (!MANUAL_EMBEDS[name]) MANUAL_EMBEDS[name] = {};
  if (!MANUAL_EMBEDS[name][season]) MANUAL_EMBEDS[name][season] = {};
  if (!MANUAL_EMBEDS[name][season][episode]) MANUAL_EMBEDS[name][season][episode] = [];

  // Add new embed
  MANUAL_EMBEDS[name][season][episode].push({
    name: server_name,
    url: url,
    type: "embed",
    added_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Embed URL added successfully',
    total_servers: MANUAL_EMBEDS[name][season][episode].length
  });
});

// -------- SIMPLE PLAYER --------
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
        .add-server { margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; }
        .add-server input { padding: 5px; margin: 5px; width: 200px; }
        .add-server button { padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; }
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

        <div class="add-server">
            <h4>Add New Server Manually</h4>
            <input type="text" id="newServerUrl" placeholder="Paste embed URL here">
            <input type="text" id="newServerName" placeholder="Server name (optional)">
            <button onclick="addNewServer()">Add Server</button>
        </div>
    </div>

    <script>
        // Load episode data
        async function loadEpisode() {
            try {
                const response = await fetch('/api/anime/${name}/${season}/${episode}');
                const data = await response.json();
                
                if (data.success) {
                    initPlayer(data.data.servers);
                } else {
                    document.getElementById('serverButtons').innerHTML = '<p style="color: red;">No servers found. Add servers manually.</p>';
                }
            } catch (error) {
                console.error('Failed to load episode:', error);
            }
        }

        function initPlayer(servers) {
            const serverButtons = document.getElementById('serverButtons');
            const videoPlayer = document.getElementById('videoPlayer');
            const loading = document.getElementById('loading');
            
            // Clear previous buttons
            serverButtons.innerHTML = '';
            
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

            videoPlayer.onerror = function() {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('loading').textContent = 'Server failed to load';
            };
        }

        // Add new server manually
        async function addNewServer() {
            const url = document.getElementById('newServerUrl').value;
            const name = document.getElementById('newServerName').value || 'Custom Server';
            
            if (!url) {
                alert('Please enter embed URL');
                return;
            }

            try {
                const response = await fetch('/api/add-embed/${name}/${season}/${episode}?url=' + encodeURIComponent(url) + '&server_name=' + encodeURIComponent(name));
                const data = await response.json();
                
                if (data.success) {
                    alert('Server added successfully!');
                    document.getElementById('newServerUrl').value = '';
                    document.getElementById('newServerName').value = '';
                    // Reload the episode to show new server
                    loadEpisode();
                } else {
                    alert('Error adding server: ' + data.error);
                }
            } catch (error) {
                alert('Failed to add server');
            }
        }

        // Load episode when page opens
        loadEpisode();
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// -------- GET ALL EMBEDS (তুমি哪些 এম্বেড add করেছো দেখতে পারবে) --------
app.get('/api/all-embeds', (req, res) => {
  res.json({
    success: true,
    data: MANUAL_EMBEDS
  });
});

// -------- HEALTH CHECK --------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Manual Embed URL API - তুমি নিজে এম্বেড URL add করবে',
    endpoints: {
      api: '/api/anime/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      add_embed: '/api/add-embed/:name/:season/:episode?url=EMBED_URL&server_name=NAME',
      all_embeds: '/api/all-embeds',
      example: '/api/anime/naruto-shippuden/1/1'
    },
    instructions: 'তুমি manually embed URLs add করবে MANUAL_EMBEDS object এ, অথবা /api/add-embed endpoint use করে'
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Manual Embed API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎮 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`📝 Add Embed: http://localhost:${PORT}/api/add-embed/naruto-shippuden/1/1?url=YOUR_EMBED_URL`);
  });
}

module.exports = app;
