const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// -------- TMDB Anime Endpoint --------
app.get('/api/anime/:tmdbId/:season/:episodeNum', async (req, res) => {
    const { tmdbId, season, episodeNum } = req.params;

    try {
        // Example: map TMDB ID to anime slug (you’ll need a DB or mapping function)
        // For demo, let’s assume tmdbId=73223 => naruto-shippuden
        let animeSlug = '';
        if (tmdbId === '73223') animeSlug = 'naruto-shippuden';
        else {
            return res.status(404).json({ error: 'TMDB ID not mapped yet' });
        }

        // Construct episode URL
        const url = `https://watchanimeworld.in/episode/${animeSlug}-${season}x${episodeNum}/`;

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
            if (src) {
                embedServers.push({
                    name: `Server ${i + 1}`,
                    url: src
                });
            }
        });

        if (embedServers.length === 0) {
            return res.status(404).json({ error: 'No embed servers found' });
        }

        res.json({
            tmdb_id: tmdbId,
            anime_slug: animeSlug,
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
