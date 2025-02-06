// server.ts
import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { scrapeZillow } from './scraper';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Explicitly type the callback function as RequestHandler
const scrapeHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { city, headless = true } = req.body;  // Default headless to true if not provided

    // Validate city input
    if (!city || typeof city !== 'string' || city.trim() === '') {
        res.status(400).json({ error: 'City is required and must be a non-empty string' });
        return;
    }

    try {
        // Call the scraper with the city and headless parameter
        const listings = await scrapeZillow(city, headless);
        res.json({ listings }); // Send the response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to scrape Zillow. Please try again later.' }); // Send the error response
    }
};

// Use the typed handler
app.post('/scrape', scrapeHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
