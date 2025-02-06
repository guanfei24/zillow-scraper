import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import userAgents from 'user-agents'; // 用于生成随机的 User-Agent
import fs from 'fs'; // 导入 fs 模块

puppeteer.use(AnonymizeUAPlugin());
puppeteer.use(StealthPlugin());

interface HomeData {
    price: string | null;
    address: string | null;
    bedrooms: string | null;
    bathrooms: string | null;
    sqft: string | null;
}

export const scrapeZillow = async (cityName: string): Promise<HomeData[]> => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--window-size=1280,800'
        ]
    });
    const page = await browser.newPage();

    // 增加模拟滚动功能
    const scrollToBottom = async (): Promise<void> => {
        const scrollableDivSelector = '#search-page-list-container'; // 目标div的选择器
        const scrollableDiv = await page.$(scrollableDivSelector); // 获取目标div元素

        if (scrollableDiv) {
            let previousHeight = 0;

            // 执行小步滚动，直到加载完所有内容
            while (true) {
                // 获取当前滚动区域的高度
                const currentHeight = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.scrollHeight : 0;
                }, scrollableDivSelector);

                // 如果当前高度和前一个高度相同，说明没有更多内容加载
                if (currentHeight === previousHeight) {
                    console.log("没有更多内容，停止滚动。");
                    break;
                }

                previousHeight = currentHeight;

                // 每次滚动一小步
                await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.scrollTop += 1000; // 每次滚动 200px
                    }
                }, scrollableDivSelector);

                // 延迟一段时间以模拟人类滚动行为
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒，调整等待时间以适应页面加载速度
            }
        } else {
            console.log("未找到滚动区域，无法执行滚动操作。");
        }
    };




    // 设置请求头、User-Agent 和视口大小（每一页时都修改）
    const setRandomHeadersAndViewport = async (): Promise<void> => {
        const randomUserAgent = new userAgents();
        const randomViewportWidth = Math.floor(Math.random() * (1920 - 320)) + 320; // 随机宽度 320 ~ 1920
        const randomViewportHeight = Math.floor(Math.random() * (1080 - 480)) + 480; // 随机高度 480 ~ 1080

        await page.setUserAgent(randomUserAgent.toString());
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Connection': 'keep-alive',
        });
        await page.setViewport({ width: randomViewportWidth, height: randomViewportHeight });
    };

    let url: string | null = `https://www.zillow.com/${cityName}/`;
    console.log(`正在爬取：${url}`);

    let allHomes: HomeData[] = [];
    let pageNum: number = 1;
    const maxPages: number = 3; // 限制最多抓取三页

    while (url && pageNum <= maxPages) {
        console.log(`正在抓取第 ${pageNum} 页的数据...`);

        // 导航到当前页面，确保页面完全加载
        await page.goto(url, { waitUntil: 'networkidle2' });

        // 模拟滚动加载更多内容
        if (pageNum === 1) {
            await scrollToBottom(); // 第一个页面模拟滚动，加载更多数据
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 设置随机请求头和视口
        await setRandomHeadersAndViewport();

        // 爬取当前页的数据
        const homesData: HomeData[] = await page.evaluate(() => {
            const homes: HomeData[] = [];
            const homeElements = document.querySelectorAll('ul.List-c11n-8-107-0__sc-1smrmqp-0 > li');

            homeElements.forEach(home => {
                const priceElement = home.querySelector('[data-test="property-card-price"]');
                const addressElement = home.querySelector('address[data-test="property-card-addr"]');
                const detailsElements = home.querySelectorAll('ul.StyledPropertyCardHomeDetailsList-c11n-8-107-0__sc-1j0som5-0 > li');

                let beds: string | null = null, baths: string | null = null, sqft: string | null = null;
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
        console.log(`已抓取第 ${pageNum} 页，共 ${homesData.length} 条数据`);

        // 查找 "下一页" 按钮的 URL
        const nextPage: string | null = await page.evaluate(() => {
            const nextBtn = document.querySelector('a[rel="next"]');
            if (nextBtn) {
                return nextBtn.getAttribute("href");
            }
            return null; // 如果没有找到下一页按钮，返回 null
        });

        if (nextPage) {
            // 构建下一页的完整 URL
            url = `https://www.zillow.com${nextPage}`;
            console.log(`跳转到下一页：${url}`);
            pageNum++;
        } else {
            console.log("没有更多页面，退出抓取。");
            url = null; // 没有找到下一页时停止循环
        }
    }

    // 将抓取的数据保存到本地 JSON 文件
    fs.writeFileSync('zillow_data.json', JSON.stringify(allHomes, null, 2), 'utf-8');
    console.log("所有房源数据已保存到 zillow_data.json 文件。");

    await browser.close();
    return allHomes;
};
