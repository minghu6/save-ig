const puppeteer = require('puppeteer');
const readlineSync = require('readline-sync');
const expandTilde = require('expand-tilde');
const axios = require('axios');
const querystring = require('querystring');  // from axios
const lineByLine = require('n-readlines');

const fs = require('fs');
const path = require('path');

const utils = require('./utils');
const CustomizedSet = utils.CustomizedSet;

const CONFIG_OBJ = JSON.parse(fs.readFileSync(expandTilde('~/.save-ig.conf.json')));
const LOGINNAME = CONFIG_OBJ.loginname;
const CHROME_PATH = CONFIG_OBJ.chromePath;
const SAVE_DIR = expandTilde(CONFIG_OBJ.saveDir);
const PAGE_TIMEOUT = CONFIG_OBJ.pageTimeout;
const VIEWPORT = CONFIG_OBJ.viewport;
const SCROLL_STEP = CONFIG_OBJ.scrollStep;
const SCROLL_WAIT = CONFIG_OBJ.scrollWait;

let downloadStat;
let enableDebug;
let latestNumber;
let specLinks;
let timeoutBase;  // used for retry


const unionSet = (set1, set2) => {
    return new Set([...set1, ...set2]);
}


// set1 - set2
const diffSet = (set1, set2) => {
    return new Set([...set1].filter(x=>!set2.has(x)));
}


const sleep = (timeout) => new Promise(resolve => setTimeout(resolve, timeout))
const wait = async ({ page, waitUntil }) => {
  const maxIdle = waitUntil === 'networkidle0' ? 0 : 2

  while (page.inflight > maxIdle) {
    await sleep(100)
  }
  await sleep(500)
  if (page.inflight > maxIdle) {
    await wait({ page, waitUntil })
  }
}

const matchedSavedALinkReg = new RegExp('https://www.instagram.com/p/[0-9a-z-_]+/', 'i')

async function createNewPage(browser) {
    const page = await browser.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh'
    });
    await page.setRequestInterception(true)

    page.inflight = 0
    page.on('request', request => {
        page.inflight += 1
        request.continue()
    })

    page.on('requestfinished', request => {
        page.inflight -= 1
    })

    page.on('requestfailed', request => {
        page.inflight -= 1
    })


    await page._client.send('Network.enable', {
        maxResourceBufferSize: 1024 * 1204 * 100,
        maxTotalBufferSize: 1024 * 1204 * 200,
    })

    return page;
}

async function toAHrefSet (ALinks) {
    const matchedALinks = [];
    for (let i=0; i < ALinks.length; i++) {
        const valueHandle = await ALinks[i].getProperty('href');
        const aHref = await valueHandle.jsonValue();

        if (matchedSavedALinkReg.test(aHref)) {
            matchedALinks.push(aHref);
        }
    }
    return new Set(matchedALinks);
}

const subUrlMatchPattern = new RegExp('(?<=/)[^/]+(?=/*$)');

async function getMediaOwnerUsername (page) {
    const aTags = await page.$$('a');

    for (let i=0;i<aTags.length;++i) {
        const innerText = await (await aTags[i].getProperty('innerText')).jsonValue();
        const href = await (await aTags[i].getProperty('href')).jsonValue();
        const subUrl = href.match(subUrlMatchPattern)[0];
        if (subUrl == innerText) {
            return subUrl;
        }
    }
}

const purePostPattern = /(?<=??????)[\w\W]+(?=???)/g;

async function fetchMediaRelatedInfo(page) {
    const subDirName = await getMediaOwnerUsername(page);

    //const subDirName = 'tmp';  // for test

    const originPost = await ((await (await page.$('title')).getProperty('innerText')).jsonValue());

    const timeElementHandles = await page.$$('time');
    const datetimeProperty = await timeElementHandles[0].getProperty('dateTime');
    const postDateTime = await datetimeProperty.jsonValue();

    const postName = postDateTime.split('.')[0].replace(new RegExp(':', 'g'), '');
    const subDir = path.join(SAVE_DIR, subDirName);

    createDirIfNotExist(subDir);

    const postFn = postName+'.post.txt';
    const postFullPath = path.join(subDir, postFn);
    if (fs.existsSync(postFullPath)) {
        console.log(`${postFn} existed, skip.`);
        downloadStat.skipped += 1;
    } else {
        const postGroup = originPost.match(purePostPattern);

        if (postGroup != null) {
            const post = postGroup[0];

            let translatedPost;
            try {
                translatedPost = await translateOnLine(post);
            } catch (e) {
                console.error('translate online failed');
                console.log(`write file ${postFn} failed`);
            }
            let extraPost;

            if (post == translatedPost) {
                extraPost = ''
            } else {
                extraPost = '\n\n\n'+translatedPost;
            }

            fs.writeFile(postFullPath, post+extraPost, err => {});
            console.log(`write file ${postFn} successful`);
            downloadStat.saved += 1;
        } else {
            downloadStat.skipped += 1;
            console.warn(originPost);
            console.warn(`can't find matched post from title`);
        }
    }

    return {subDir, postName};
}

async function downloadOneMedia(maxSizeMedia, subDir, postName) {
    const mediaFn = postName + maxSizeMedia.ext;
    const mediaFullPath = path.join(subDir, mediaFn);

    if (fs.existsSync(mediaFullPath)) {
        console.log(`${mediaFn} existed, skip.`);
        downloadStat.skipped += 1;
    } else {
        fs.writeFile(mediaFullPath, await maxSizeMedia.buffer, err => {
            if (err) {
                console.error(err);
                throw new Error(`write file ${mediaFn} failed`);
            } else {
                console.log(`write file ${mediaFn} successful`);
                downloadStat.saved += 1;
            }
        })
    }
}

async function downloadNPMedia(medias, subDir, postName) {
    // const allLiElem = await page.$$('li');  // ????????????????????????????????????????????????
    // const img
    // allLiElem.map(liElem => {
    //     const imgHandles = liElem.$$('img');

    //     if (imgHandles.length == 1) {
    //         await
    //     }
    // })

    // for (let i=0; i<allLiElem.length; ++i) {
    //     allLiElem[i].
    // }

    for (let i=0; i<medias.length; ++i) {
        const media = medias[i];
        const mediaFn = `${postName}.${i}${media.ext}`;
        const mediaFullPath = path.join(subDir, mediaFn);

        if (fs.existsSync(mediaFullPath)) {
            if (enableDebug) {
                console.log(`${mediaFn} existed, skip.`);
            }
            downloadStat.skipped += 1;
        } else {
            fs.writeFile(mediaFullPath, await media.buffer, err => {
                if (err) {
                    console.error(err);
                    throw new Error(`write file ${mediaFn} failed`);
                } else {
                    console.log(`write file ${mediaFn} successful`);
                    downloadStat.saved += 1;
                }
            })
        }
    }
}

async function npExisted(page) {
    return (await page.$$('.coreSpriteRightChevron')).length > 0;
}

// ensure that all media have been loaded
async function execNP(page) {
    let count;
    count = 1;

    // ??????NP???????????????????????????????????????????????????????????????????????????
    // ??????????????????????????????????????????????????????
    let firstVideo;
    firstVideo = true;
    while (true) {
        const ctlBtns = await page.$$('div[aria-label="??????"]');

        let btn;
        if (firstVideo) {
            btn = ctlBtns[0];
            firstVideo = false;
        } else {
            btn = ctlBtns.reverse()[0];
        }

        try {
            await page.evaluate(e => e.click(), btn);
        } catch (e) {
        }
        // ???????????????????????????????????????
        if (ctlBtns.length > 0) {
            await sleep(SCROLL_WAIT * 2 * timeoutBase);
        } else {
            await sleep(SCROLL_WAIT * timeoutBase);
        }

        if ((await page.$('.coreSpriteRightChevron')) == null) break;
        await page.click('.coreSpriteRightChevron');
        count += 1;
    }

    return count;
}

async function saveMedia(browser, aHref) {
    const page = await createNewPage(browser);

    let maxSizeMedia;
    maxSizeMedia = {
        type: '',
        size: 0,
        url: '',
        buffer: '',
        ext: ''
    };

    const mediaSet = new CustomizedSet([], media => media.size);

    page.on('response', async function (response) {
        if (response.url().includes('https://scontent-')) {
            try {
                const headers = await response.headers();
                const mediaObj = {
                    type: headers['content-type'],
                    size: parseInt(headers['content-length']),
                    url: response.url(),
                    buffer: response.buffer()
                }

                if (mediaObj.type === 'image/jpeg' || mediaObj.type == 'video/mp4') {
                    mediaObj.ext = (mediaObj.type === 'image/jpeg' ? '.jpg' : '.mp4');
                    mediaSet.add(mediaObj);
                }
            } catch (e) {
                console.error(e);
            }
        }
    })

    const getMaxSizedMedia = () => {
        const mediaList = mediaSet.toSortedArray().reverse();
        return mediaList[0];
    }

    const getTopNMaxSizeMedia = (n) => {
        const mediaList = mediaSet.toSortedArray().reverse();
        return mediaList.slice(0, n);
    }

    const _saveMedia = async (page, aHref, reTry=0) => {
        await page.goto(aHref, {waitUntil: 'networkidle0'});
        //await page.goto('https://www.instagram.com/p/B59Z1xdFoLv/', {waitUntil: 'networkidle0'});
        //await page.goto('https://www.instagram.com/p/B4k8wrClAHu/', {waitUntil: 'networkidle0'});

        if (getMaxSizedMedia() != undefined) {
            const {subDir, postName} = await fetchMediaRelatedInfo(page);

            if (await npExisted(page)) {
                const pNumber = await execNP(page);
                await downloadNPMedia(getTopNMaxSizeMedia(pNumber), subDir, postName);
            } else {
                const btn = await page.$('div[aria-label="??????"]');
                if (btn != null) {
                    try {
                        await page.evaluate(e => e.click(), btn);
                    } catch (e) {
                    }
                    await sleep(SCROLL_WAIT * 2 * timeoutBase);
                } else {
                    await sleep(SCROLL_WAIT * timeoutBase);
                }

                // < 10k
                if (getMaxSizedMedia().size < 10000) {
                    console.warn('There are maybe something wrong for the file is too tiny.');
                    console.warn(`tiny file aHref: ${aHref}\nfile url:${maxSizeMedia.url}`);
                }

                await downloadOneMedia(getMaxSizedMedia(), subDir, postName);
            }

        } else {
            if (reTry > 0) {
                console.error(`can't find any media ${aHref}`);
            } else {
                await _saveMedia(page, aHref, reTry+1);
            }
        }
    };

    await _saveMedia(page, aHref, 0);

    await page.close();
}

async function saveALinks(browser, aLinks) {
    timeoutBase = 1;

    await Promise.all(aLinks.map(async aHref => {
        try {
            await saveMedia(browser, aHref);
        } catch (e) {
            console.error(e);
            console.error(`saveMedia failed of ${aHref}\n`);
            downloadStat.failedAHrefSet.add(aHref);
        }
    }));
    // for (let i=0;i<aLinks.length;++i) {
    //     const aHref = aLinks[i];
    //     try {
    //         await saveMedia(browser, aHref);
    //     } catch (e) {
    //         console.error(e);
    //         console.error(`saveMedia failed of ${aHref}\n`);
    //         downloadStat.failedAHrefSet.add(aHref);
    //     }
    // }  // ?????????????????????????????????????????????
}

async function loadSavedPage(browser, page) {
    const bodyHandle = await page.$('body');

    let prevH;
    let curH;
    let prevALinks;
    let curALinks;
    let boundingBox;

    await page.setViewport(VIEWPORT);
    boundingBox = await bodyHandle.boundingBox();
    curH = boundingBox.y;
    prevH = Number.MAX_SAFE_INTEGER;
    prevALinks = new Set();
    curALinks = new Set();

    while (prevH !== curH && prevALinks.size < latestNumber) {
        prevALinks = unionSet(prevALinks, curALinks);
        curALinks = await toAHrefSet(await page.$$('a'));
        const newALinks = diffSet(curALinks, prevALinks);

        try {
            await saveALinks(browser, [...newALinks]);
        } catch (e) {
            console.error('An exception occurred when scroll page to exec saveALinks function');
            console.error(e);
        }

        // ???????????????????????????viewport??????
        await page.evaluate(step => window.scrollBy(0, step), SCROLL_STEP);

        await wait({ page, waitUntil: 'networkidle0' });
        prevH = curH;
        boundingBox = await bodyHandle.boundingBox();
        curH = boundingBox.y;
        console.log(`lastPosition: ${prevH}`);
    }
}

const createDirIfNotExist = dirname => {
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname);
    }
}


async function main() {
    const username = LOGINNAME;
    latestNumber = Number.MAX_SAFE_INTEGER;
    let fn;

    for (let i=0;i<process.argv.length;++i) {
        if (process.argv[i] == '--debug') {
            enableDebug = true;
        }

        if (process.argv[i] == '--latest' && process.argv[i+1]) {
            latestNumber = parseInt(process.argv[i+1]);
        }

        if (process.argv[i] == '--links') {
            specLinks = true;
            fn = process.argv[i+1]
            timeoutBase = parseInt(process.argv[i+2]);
        }
    }

    const password = readlineSync.question(`@${username} password: `, {hideEchoBack: true});

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--lang=en'],
        headless: !enableDebug,
        executablePath: CHROME_PATH
    });

    createDirIfNotExist(SAVE_DIR);

    const loginPage = await createNewPage(browser);

    loginPage.on('dialog', async dialog => {
        console.log('catch a dialog')
        console.log(dialog.message());
        await dialog.dismiss();
    });

    await loginPage.goto('https://www.instagram.com/accounts/login/', {waitUntil: 'networkidle0'});

    console.log('login Page loaded!')
    await loginPage.type('input[name="username"]', LOGINNAME);
    await loginPage.type('input[name="password"]', password);

    await Promise.all([
        loginPage.waitForNavigation(),
        loginPage.click('button[type="submit"]'),
      ]);

    loginPage.close();

    if (specLinks) {
        liner = new lineByLine(fn);
        const links = [];
        let line;
        while (line = liner.next()) {
            if (line !== '') {
                const decodedLine = line.toString('ascii');
                console.log(decodedLine);
                links.push(decodedLine);
            }
        }

        await saveMediaByLinks(browser, links, timeoutBase);

        await browser.close();
        return;
    }


    const savedUrl = `https://www.instagram.com/${username}/saved/`;
    const savedMediaPage = await createNewPage(browser);
    await savedMediaPage.goto(savedUrl, {waitUntil: 'networkidle0'});
    console.log('saved Page loaded!');

    const allPostUrl = `https://www.instagram.com/${username}/saved/all-posts`
    await savedMediaPage.goto(allPostUrl, {waitUntil: 'networkidle0'});
    console.log('all posts Page loaded!');

    try {
        await loadSavedPage(browser, savedMediaPage);
    } catch (e) {
        console.error('loadSavedPage function exec failed!!!')
        console.error(e);
    }
    await savedMediaPage.close();

    await tryResolveFailedAHrefs(browser);
    await browser.close();
}


downloadStat = {
    skipped: 0,
    saved: 0,
    failed: 0,
    failedAHrefSet: new Set([])
};

async function translateOnLine(word) {
    const resp = await axios.post('http://fy.iciba.com/ajax.php?a=fy', querystring.stringify({
        f: 'auto',
        t: 'zh_CN',
        w: word
    }));

    const out = resp.data.content.out;
    return out;
}

async function saveMediaByLinks(browser, aLinks, base) {
    timeoutBase = base;

    for (let i=0; i<aLinks.length; ++i) {
        try {
            await saveMedia(browser, aLinks[i]);
            console.log(`${aHref} solved`);
            downloadStat.failedAHrefSet.delete(aLinks[i])
        } catch (e) {
            console.error(e);
        }
    }
}

function writeFailedLinksLog() {
    const logger = fs.createWriteStream('save_ig_failed_links.log', {flags: 'a'});

    logger.write('aaaaaaa\n');
    logger.write('bbbbbbb\n');
    logger.write('ccccccc\n');
}

async function tryResolveFailedAHrefs(browser) {
    const aLinks = [...downloadStat.failedAHrefSet];
    if (aLinks.length == 0) return;

    console.log('\nTry to solve failed aHrefs...');

    await saveMediaByLinks(browser, aLinks, 2);
    downloadStat.failed = downloadStat.failedAHrefSet.size;
    if (downloadStat.failed > 0) {
        await saveMediaByLinks(browser, [...downloadStat.failedAHrefSet], 4);
    }

    downloadStat.failed = downloadStat.failedAHrefSet.size;
    if (downloadStat.failed){
        console.error('\nFailed AHref:');

        Array.from(downloadStat.failedAHrefSet).map(aHref =>{
            console.error(`${aHref}`);
        });
    }

}
//writeFailedLinksLog();
// translateOnLine(`??????`)
main().catch(e => {
    console.log("ERROR .........................................................");
    console.log(e);
}).finally(() => {
    console.log(`skipped ${downloadStat.skipped}`);
    console.log(`saved ${downloadStat.saved}`);
    console.log(`failed ${downloadStat.failed}`);
});

