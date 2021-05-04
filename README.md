## Brief:
利用Chrome Headless来保存IG上收藏的图片、短视频

## Usage:
```bash
node:
    node app.js --debug
args:
    --debug  // headless: false
    --latest  // update latest number of saved page
    --links <links-fn> <n>  // n: timebase, links-fn: filename which has links to download

npm:
    npm test -- --latest 30
    npm start -- --links a.tmp 2
```


## For Ubuntu18.04:
```bash
sudo apt-get install gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

## Essential Config:
`~/.save-ig.conf.json`
```json
{
    "loginname": "xxxxxxx",
    "chromePath": "/mnt/c/Program\ Files\ \(x86\)/Google/Chrome/Application/chrome.exe",
    "saveDir": "~/ig",
    "pageTimeout": 60000,
    "viewport": {
        "width": 1920,
        "height": 1080
    },
    "scrollStep": 500,
    "scrollWait": 1000
}
```
* `loginname` is username, not email or phone number
 (because i don't want to write additional code to fetch username)
* time unit (ms)
* input password on console
* For Windows or WSL, code's disk partition should be same with chrome.exe's
## Issue:
1. 更能最重要的是chrome简直是吃内存的怪兽，8G电脑跑基本上只能运行一个实例
1. 多图、视频网络较慢的情况下可能会失败，试用 `npm start --links <links-fn> <n>`来重试
1. 无头浏览器看不到页面结构，不好调试，现在只能开着浏览器`--debug`

## TODO:
1. Facebook合作帐号的登录
1. 新的IG收藏分类了，考虑支持这一变动
1. 前端就是一个轻而易举地消耗时间然后每次从发明轮子开始的时尚领域，我是干别的去了，所以以上TODO大概就是NOT-TODO