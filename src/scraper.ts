import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import userAgents from 'user-agents'; // Used to generate random User-Agent
import fs from 'fs'; // Import fs module

puppeteer.use(AnonymizeUAPlugin());
puppeteer.use(StealthPlugin());

interface HomeData {
    price: string | null;
    address: string | null;
    bedrooms: string | null;
    bathrooms: string | null;
    sqft: string | null;
}

// ** Third-party API Usage **:
// This project does not use any third-party APIs. The Google search step has been skipped due to verification requirements.
// However, third-party APIs such as the official Google API or services like 2Captcha can be integrated to handle verification
// issues and enhance functionality.

// ** Zillow Data Scraping Limitations **:
// The current scraping functionality is limited to retrieving data only from the first page of Zillow listings. When attempting to
// navigate to subsequent pages, the system is flagged as a bot by Zillow and is unable to fetch data from those pages.
// 
// ** Potential Solutions to Improve Scraping Stability **:
// - Browser Parameter Reset: One approach to mitigate the bot detection issue could be resetting browser parameters between pages.
// - Proxy Pool Rotation: Implementing a proxy pool to rotate IP addresses could help bypass restrictions and improve data scraping
//   stability over multiple pages.
export const scrapeZillow = async (cityName: string, headless: boolean = true): Promise<HomeData[]> => {
    const browser = await puppeteer.launch({
        headless: headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--window-size=1280,800'
        ]
    });
    const page = await browser.newPage();

    // Add scroll simulation function
    const scrollToBottom = async (): Promise<void> => {
        const scrollableDivSelector = '#search-page-list-container'; // Target div selector
        const scrollableDiv = await page.$(scrollableDivSelector); // Get the target div element

        if (scrollableDiv) {
            let previousHeight = 0;
            let currentHeight = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.scrollHeight : 0;
            }, scrollableDivSelector);

            let scrollAttempts = 0; // Track number of attempts to scroll

            // Keep scrolling until no new content loads
            while (currentHeight > previousHeight || scrollAttempts < 5) { // Allow up to 5 scroll attempts
                previousHeight = currentHeight;

                // Scroll down by 1000px
                await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.scrollTop += 1000; // Scroll 1000px each time
                    }
                }, scrollableDivSelector);

                // Wait for content to load
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for new content

                // Get current height of the scrollable area again
                currentHeight = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.scrollHeight : 0;
                }, scrollableDivSelector);

                // Count the number of scroll attempts
                scrollAttempts++;
            }

            console.log("Reached the bottom or attempted to load more content.");
        } else {
            console.log("Scroll area not found, unable to perform scroll operation.");
        }
    };



    // Set random headers, User-Agent, and viewport size (modified on each page)
    const setRandomHeadersAndViewport = async (): Promise<void> => {
        const randomUserAgent = new userAgents();
        const randomViewportWidth = Math.floor(Math.random() * (1920 - 320)) + 320; // Random width 320 ~ 1920
        const randomViewportHeight = Math.floor(Math.random() * (1080 - 480)) + 480; // Random height 480 ~ 1080

        await page.setUserAgent(randomUserAgent.toString());
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Connection': 'keep-alive',
        });
        await page.setViewport({ width: randomViewportWidth, height: randomViewportHeight });
    };

    let url: string | null = `https://www.zillow.com/${cityName}/`;
    console.log(`Scraping: ${url}`);

    let allHomes: HomeData[] = [];
    let pageNum: number = 1;
    const maxPages: number = 3; // Limit to scraping a maximum of three pages

    while (url && pageNum <= maxPages) {
        console.log(`Scraping data from page ${pageNum}...`);

        // Navigate to the current page and ensure it fully loads
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Simulate scrolling to load more content
        await scrollToBottom();

        // Set random headers and viewport
        await setRandomHeadersAndViewport();

        // Scrape data from the current page
        const homesData: HomeData[] = await page.evaluate(() => {
            const homes: HomeData[] = [];
            const homeElements = document.querySelectorAll('ul.List-c11n-8-107-0__sc-1smrmqp-0 > li');

            homeElements.forEach(home => {
                const priceElement = home.querySelector('[data-test="property-card-price"]');
                const addressElement = home.querySelector('address[data-test="property-card-addr"]');
                const detailsElements = home.querySelectorAll('ul.StyledPropertyCardHomeDetailsList-c11n-8-107-0__sc-1j0som5-0 > li');

                let beds: string | null = null, baths: string | null = null, sqft: string | null = null;

                //limited to 3 details
                if (detailsElements.length >= 3) {
                    beds = detailsElements[0]?.querySelector('b')?.textContent?.trim() ?? null;
                    baths = detailsElements[1]?.querySelector('b')?.textContent?.trim() ?? null;
                    sqft = detailsElements[2]?.querySelector('b')?.textContent?.trim() ?? null;
                }

                homes.push({
                    price: priceElement?.textContent?.trim() ?? null,
                    address: addressElement?.textContent?.trim() ?? null,
                    bedrooms: beds,
                    bathrooms: baths,
                    sqft: sqft
                });
            });

            return homes;
        });

        allHomes.push(...homesData);
        console.log(`Scraped page ${pageNum}, found ${homesData.length} homes`);

        // Find the "Next Page" button URL
        const nextPage: string | null = await page.evaluate(() => {
            const nextBtn = document.querySelector('a[rel="next"]');
            if (nextBtn) {
                return nextBtn.getAttribute("href");
            }
            return null; // Return null if "Next Page" button is not found
        });

        if (nextPage) {
            // Build the complete URL for the next page
            url = `https://www.zillow.com${nextPage}`;
            console.log(`Moving to next page: ${url}`);
            pageNum++;
        } else {
            console.log("No more pages, stopping scraping.");
            url = null; // Stop the loop when no next page is found
        }
    }

    // Save scraped data to a local JSON file
    fs.writeFileSync('zillow_data.json', JSON.stringify(allHomes, null, 2), 'utf-8');
    console.log("All home data has been saved to zillow_data.json file.");

    await browser.close();
    return allHomes;
};
