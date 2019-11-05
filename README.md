## Brief:
利用Chrome Headless来保存IG上收藏的图片、短视频

## Usage:
```bash
save-ig
save-ig --debug  // headless: false
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
* (ms)
* input password on console
## Issue:

1. unknown behavior upon download Big video
2. 访问ig的语言限定简中 (一些元素定位依靠本地化的字符串比对)
3. 二元认证？那是什么东西！
4. 外文是不是可以翻译一下，但找不到水平特别高的翻译和开放接口（谷歌翻译也就那样吧）
5. 总感觉这种工具寿命很短，一旦页面结构有一点儿变化就可能直接GG，需要琐碎地不断维护
6. 更能最重要的是chrome简直是吃内存的怪兽，8G电脑跑一个就别想再开一个看资料了


## Core Idea:
文件一分size，一分quality,直接过滤查找size最大的媒体文件
优点是不会受页面结构变动的影响，缺点就是多p的顺序就没了。

## About Contribute:
1. 感谢金山翻译
2. 新的代码基于develop分支开一个特性分支
3. vscode编辑器，
4. vscode debug(追踪运行流程) + node-repl(本地环境的代码repl测试) + chrome dev tools(分析页面响应、页面结构) 作为调试工具

## Craft:

