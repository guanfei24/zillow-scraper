# Home Scraper

## Description

This project is a home scraper built with **Puppeteer** for scraping property listings from Zillow. The scraper retrieves property information such as price, address, number of bedrooms, bathrooms, and square footage for a given city. It supports dynamic content loading by simulating scroll actions to load more listings.

## Technologies Used

- **Node.js** for the backend
- **Puppeteer** for web scraping
- **Express** for handling API requests
- **TypeScript** for type safety
- **Nodemon** for automatic server restarts during development

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd zillow-scraper
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the server:

   ```bash
   npm run dev
   ```

   This starts the server on `http://localhost:3000`.

## API

### POST /scrape

The `/scrape` endpoint accepts a `POST` request with the following JSON body:

```json
{
  "city": "city-state",
  "headless": false
}
```

- **city**: Name of the city to scrape listings from (e.g., "new-york-ny").
- **headless**: Controls Controlling headless properties of browser(default: true).

#### Response

On success, the response will contain a list of property listings:

```json
{
  "listings": [
    {
      "price": "$1,200,000",
      "address": "123 Main St, New York, NY 10001",
      "bedrooms": "3",
      "bathrooms": "2",
      "sqft": "1,500"
    },
    {
      "price": "$950,000",
      "address": "456 Elm St, New York, NY 10002",
      "bedrooms": "2",
      "bathrooms": "1",
      "sqft": "1,200"
    }
  ]
}
```

On error, the response will contain an error message:

```json
{
  "error": "City is required"
}
```

If there is a failure in scraping, the error message will be:

```json
{
  "error": "Failed to scrape Zillow"
}
```

## Testing with Postman

1. Create a new `POST` request in Postman.
2. Set the URL to `http://localhost:3000/scrape`.
3. In the request body, select `raw` and `JSON`, and enter the following data:

```json
{
  "city": "new-york-ny",
  "headless": false
}
```

4. Send the request to see the listings for the specified city.

## Contributing

Feel free to open issues or submit pull requests for improvements or bug fixes.

## License

MIT License
