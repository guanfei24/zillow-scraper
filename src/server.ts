// server.ts
import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { scrapeZillow } from './scraper';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Explicitly type the callback function as RequestHandler
const scrapeHandler: RequestHandler = async (req: Request, res: Response) => {
    const { city } = req.body;

    if (!city) {
        res.status(400).json({ error: 'City is required' });
        return; // Ensure the function exits after sending the response
    }

    try {
        const listings = await scrapeZillow(city);
        res.json({ listings }); // Send the response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to scrape Zillow' }); // Send the error response
    }
};

// Use the typed handler
app.post('/scrape', scrapeHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});