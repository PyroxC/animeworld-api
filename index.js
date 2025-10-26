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

// Your target domains to search for in page source
const TARGET_DOMAINS = [
  'play.zephyrflick.top',
  'short.icu', 
  'cloudy.upns.one'
];

// -------- MANUAL DOMAIN SEARCH API --------
app.get('/api/anime/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  try {
    console.log(`🔍 Manually searching for domains: ${TARGET_DOMAINS.join(', ')}`);
    
    const toonstreamUrl = `https://toonstream.love/episode/${name}-${season}x${episode}/`;
    
    let foundServers = [];

    try {
      console.log(`📡 Fetching page source: ${toonstreamUrl}`);
      
      const response = await axios.get(toonstreamUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://toonstream.love/'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Extract episode info
      const episodeTitle = $('h1.entry-title').text().trim() || `${name.replace(/-/g, ' ')} Episode ${episode}`;

      console.log('🕵️‍♂️ Searching for iframes with target domains...');

      // Search for ALL iframes in the page
      $('iframe').each((index, element) => {
        const iframe = $(element);
        const src = iframe.attr('src');
        const dataSrc = iframe.attr('data-src');
        
        // Use data-src if available, otherwise src
        const embedUrl = dataSrc || src;
        
        if (embedUrl) {
          console.log(`📺 Found iframe: ${embedUrl}`);
          
          // Check if this embed URL contains any of our target domains
          TARGET_DOMAINS.forEach(domain => {
            if (embedUrl.includes(domain)) {
              console.log(`✅ MATCHED! Domain: ${domain} | URL: ${embedUrl}`);
              
              let finalUrl = embedUrl;
              if (embedUrl.startsWith('//')) {
                finalUrl = 'https:' + embedUrl;
              }

              foundServers.push({
                name: `${domain} Server`,
                url: finalUrl,
                type: 'iframe',
                domain: domain,
                full_iframe_code: iframe.toString().substring(0, 200) + '...'
              });
            }
          });
        }
      });

      // Also search in script tags for embed URLs
      console.log('🔍 Searching in script tags...');
      $('script').each((index, element) => {
        const scriptContent = $(element).html();
        if (scriptContent) {
          TARGET_DOMAINS.forEach(domain => {
            if (scriptContent.includes(domain)) {
              // Look for URLs in the script
              const urlPatterns = [
                /src=["']([^"']+)["']/g,
                /url=["']([^"']+)["']/g,
                /file=["']([^"']+)["']/g,
                /embed=["']([^"']+)["']/g
              ];
              
              urlPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(scriptContent)) !== null) {
                  const url = match[1];
                  if (url.includes(domain)) {
                    console.log(`✅ Found in script: ${url}`);
                    
                    let finalUrl = url;
                    if (url.startsWith('//')) {
                      finalUrl = 'https:' + url;
                    }

                    // Avoid duplicates
                    if (!foundServers.some(server => server.url === finalUrl)) {
                      foundServers.push({
                        name: `${domain} Script Server`,
                        url: finalUrl,
                        type: 'script_embed',
                        domain: domain
                      });
                    }
                  }
                }
              });
            }
          });
        }
      });

    } catch (toonstreamError) {
      console.log('❌ Failed to fetch Toonstream:', toonstreamError.message);
    }

    // Remove duplicate servers
    const uniqueServers = foundServers.filter((server, index, self) =>
      index === self.findIndex(s => s.url === server.url)
    );

    console.log(`🎯 Total unique servers found: ${uniqueServers.length}`);

    // If no servers found, provide default servers for testing
    if (uniqueServers.length === 0) {
      console.log('⚠️ No servers found, using default test servers');
      uniqueServers.push(
        {
          name: "Zephyr Server (Test)",
          url: "https://play.zephyrflick.top/video/49182f81e6a13cf5eaa496d51fea6406",
          type: "test_default",
          domain: "play.zephyrflick.top"
        },
        {
          name: "Short ICU Server (Test)",
          url: "https://short.icu/czoaptlRH", 
          type: "test_default",
          domain: "short.icu"
        },
        {
          name: "Cloudy Server (Test)",
          url: "https://cloudy.upns.one/#krllwg",
          type: "test_default", 
          domain: "cloudy.upns.one"
        }
      );
    }

    res.json({
      success: true,
      search_info: {
        source_page: toonstreamUrl,
        target_domains: TARGET_DOMAINS,
        domains_found: [...new Set(uniqueServers.map(s => s.domain))]
      },
      data: {
        anime_name: name,
        season: parseInt(season),
        episode: parseInt(episode),
        title: `${name.replace(/-/g, ' ')} Episode ${episode}`,
        servers: uniqueServers,
        total_servers: uniqueServers.length
      }
    });

  } catch (err) {
    console.error('❌ API Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to search for embed servers',
      message: err.message
    });
  }
});

// -------- PLAYER WITH MANUALLY FOUND SERVERS --------
app.get('/player/:name/:season/:episode', async (req, res) => {
  const { name, season, episode } = req.params;

  try {
    // Get servers from our API
    const apiUrl = `http://localhost:${process.env.PORT || 3000}/api/anime/${name}/${season}/${episode}`;
    const response = await axios.get(apiUrl);
    const data = response.data;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${data.data.title}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; color: white; font-family: Arial; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px; }
        .header h1 { font-size: 22px; margin-bottom: 5px; }
        .search-info { color: #ccc; font-size: 12px; margin-top: 10px; }
        .video-container { background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
        .video-wrapper { position: relative; width: 100%; padding-bottom: 56.25%; }
        #videoPlayer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; background: #000; }
        .servers { background: #1a1a1a; padding: 15px; border-radius: 8px; }
        .servers h3 { margin-bottom: 10px; }
        .server-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .server-btn { padding: 8px 12px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .server-btn.active { background: #e50914; }
        .server-domain { font-size: 10px; color: #888; display: block; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; background: rgba(0,0,0,0.8); padding: 20px; border-radius: 8px; }
        .current { margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 4px; font-size: 12px; }
        .debug { margin-top: 15px; padding: 10px; background: #333; border-radius: 4px; font-size: 11px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.data.title}</h1>
            <div class="search-info">
                🔍 Searched domains: ${data.search_info.target_domains.join(', ')} | 
                ✅ Found: ${data.search_info.domains_found.join(', ')} |
                📺 Total servers: ${data.data.total_servers}
            </div>
        </div>
        
        <div class="video-container">
            <div class="video-wrapper">
                <div class="loading" id="loading">Select a server to play</div>
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
            <h3>Manually Found Servers</h3>
            <div class="server-buttons" id="serverButtons"></div>
            <div class="current" id="currentServer">
                No server selected yet
            </div>
            <div class="debug" id="debugInfo">
                <strong>Debug Info:</strong><br>
                Source: ${data.search_info.source_page}<br>
                Search Method: Manual domain extraction from page source
            </div>
        </div>
    </div>

    <script>
        const servers = ${JSON.stringify(data.data.servers)};
        
        function initPlayer() {
            const serverButtons = document.getElementById('serverButtons');
            const videoPlayer = document.getElementById('videoPlayer');
            const loading = document.getElementById('loading');
            const currentServer = document.getElementById('currentServer');
            
            console.log('Available servers:', servers);
            
            // Create server buttons
            servers.forEach((server, index) => {
                const btn = document.createElement('button');
                btn.className = 'server-btn';
                btn.innerHTML = \`
                    \${server.name}<br>
                    <span class="server-domain">\${server.domain} • \${server.type}</span>
                \`;
                btn.onclick = () => switchServer(index);
                serverButtons.appendChild(btn);
            });
            
            // Auto-load first server
            if (servers.length > 0) {
                switchServer(0);
            }
        }
        
        function switchServer(index) {
            const server = servers[index];
            
            // Update UI
            document.querySelectorAll('.server-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
            
            currentServer.innerHTML = \`
                <strong>Now Playing:</strong> \${server.name} | 
                <strong>Domain:</strong> \${server.domain} | 
                <strong>URL:</strong> \${server.url.substring(0, 50)}...
            \`;
            
            // Show loading
            loading.style.display = 'block';
            loading.textContent = 'Loading ' + server.domain + '...';
            videoPlayer.style.display = 'none';
            
            // Change iframe source to the EXACT embed URL we found
            videoPlayer.src = server.url;
            
            // Handle load
            videoPlayer.onload = () => {
                loading.style.display = 'none';
                videoPlayer.style.display = 'block';
                currentServer.innerHTML = \`
                    <strong style="color: green;">✅ Playing:</strong> \${server.name} | 
                    <strong>Domain:</strong> \${server.domain}
                \`;
            };
            
            videoPlayer.onerror = () => {
                loading.style.display = 'block';
                loading.innerHTML = \`
                    ❌ Failed to load: \${server.domain}<br>
                    <small>Try another server</small>
                \`;
                currentServer.innerHTML = \`
                    <strong style="color: red;">❌ Failed:</strong> \${server.name} | 
                    <strong>Domain:</strong> \${server.domain}
                \`;
            };
        }
        
        document.addEventListener('DOMContentLoaded', initPlayer);
    </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    const fallbackHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${name} - Episode ${episode}</title>
    <style>body{margin:0;padding:0;background:#000;}</style>
</head>
<body>
    <div style="color: white; text-align: center; padding: 50px;">
        <h2>Error Loading Player</h2>
        <p>Failed to fetch episode data</p>
    </div>
</body>
</html>
    `;
    res.send(fallbackHtml);
  }
});

// -------- HEALTH CHECK --------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Manual Domain Search API - Extracts embeds from Toonstream source',
    endpoints: {
      api: '/api/anime/:name/:season/:episode',
      player: '/player/:name/:season/:episode',
      example: '/api/anime/naruto-shippuden/1/1'
    },
    target_domains: TARGET_DOMAINS,
    search_method: 'Manually searches Toonstream page source for iframes containing target domains'
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 Manual Domain Search API running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/anime/naruto-shippuden/1/1`);
    console.log(`🎮 Player: http://localhost:${PORT}/player/naruto-shippuden/1/1`);
    console.log(`🔍 Target Domains: ${TARGET_DOMAINS.join(', ')}`);
    console.log(`🕵️‍♂️ Search Method: Manual extraction from Toonstream page source`);
  });
}

module.exports = app;
