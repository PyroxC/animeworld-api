// File: server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// -------- Anime List Endpoint --------
app.get('/api/anime/list', async (req, res) => {
    try {
        const response = await axios.get('https://watchanimeworld.in/');
        const $ = cheerio.load(response.data);
        const animeList = [];

        // Example selector - adjust based on actual site structure
        $('div.main_series a').each((i, el) => {
            const title = $(el).attr('title') || $(el).text().trim();
            const link = $(el).attr('href');
            const id = link.split('/').pop(); // get last part of URL as ID
            const thumbnail = $(el).find('img').attr('src');

            animeList.push({ id, title, thumbnail, link });
        });

        res.json(animeList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch anime list' });
    }
});

// -------- Episode Details Endpoint --------
app.get('/api/anime/:animeId/:episodeNum', async (req, res) => {
    const { animeId, episodeNum } = req.params;

    try {
        const url = `https://watchanimeworld.in/series/${animeId}/episode-${episodeNum}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1.entry-title').text().trim() || `Episode ${episodeNum}`;
        const embedServers = {};

        // Example: select all iframe servers
        $('iframe').each((i, el) => {
            const serverName = $(el).attr('data-server') || `server${i+1}`;
            const embedUrl = $(el).attr('src');
            embedServers[serverName] = embedUrl;
        });

        res.json({
            anime_id: animeId,
            episode: episodeNum,
            title,
            embed_servers: embedServers
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch episode details' });
    }
});

// -------- Start Server --------
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
});
