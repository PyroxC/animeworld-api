const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// -------- Anime List Endpoint --------
app.get('/api/anime/list', async (req, res) => {
    try {
        const response = await axios.get('https://watchanimeworld.in/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const $ = cheerio.load(response.data);
        const animeList = [];

        $('div.main_series a').each((i, el) => {
            const title = $(el).attr('title') || $(el).text().trim();
            const link = $(el).attr('href');
            const id = link.split('/').filter(Boolean).pop();
            const thumbnail = $(el).find('img').attr('src');

            animeList.push({ id, title, thumbnail, link });
        });

        res.json(animeList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch anime list' });
    }
});

// -------- Episode Details Endpoint (Torofilm-style) --------
app.get('/api/anime/:animeId/:season?/:episodeNum', async (req, res) => {
    const { animeId, episodeNum } = req.params;
    let season = req.params.season || '1'; // Default season 1

    try {
        // Correct episode URL
        const url = `https://watchanimeworld.in/episode/${animeId}-${season}x${episodeNum}/`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);

        const title = $('h1.entry-title').first().text().trim() || `Episode ${episodeNum}`;
        const description = $('div.entry-content p').first().text().trim() || '';
        const thumbnail = $('div.post-thumbnail img').attr('src') || '';

        const embedServers = [];
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if(src) {
                embedServers.push({
                    name: `Server ${i+1}`,
                    url: src
                });
            }
        });

        if(embedServers.length === 0) {
            return res.status(404).json({ error: 'No embed servers found' });
        }

        res.json({
            anime_id: animeId,
            season: parseInt(season),
            episode: parseInt(episodeNum),
            title,
            description,
            thumbnail,
            embed_servers: embedServers
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch episode details' });
    }
});

// -------- Start Server --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Anime API server running on port ${PORT}`);
});
