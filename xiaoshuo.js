const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const px = require('./proxyserver');
const fsut = require('./fileutil');

const MAX_RT = 3;													//重试次数
const TEMP_DIR = './无限曙光/';											//临时目录
const NOVEL_FILE = './无限曙光.txt';										//生成的文件
const CHAPTERS_URL = 'https://www.88dus.com/xiaoshuo/39/39326/';		//目录地址
const CHAPTERS_SKIP = 0;											//目录中需要跳过的条目(去除头部非目录的链接)
const CONTENT_WITH_CHAPTER_NAME = true;								//是否添加目录中的章节名字到正文头部
const MULTI_PAGE = false;											//章节是否为分页形式
const CHAPTERS_CSS_SELECTOR = 'body > div.mulu > ul > li > a[href]';			//目录选择器
const CONTENT_CSS_SELECTOR = 'body > div.novel > div.yd_text2';					//内容选择器
const CONTENT_RESULT_TYPE = 0;										//内容形式 0--innerText 1--innerHTML
const GAP_EACH_CHAPTER = '\n';										//章节分界线
const DEBUG = false;													//调试模式(用于控制logd)
const DEBUG_1 = false;												//仅调试一条数据(不使用代理浏览器且只刷一条数据)

/**
*	处理获取到的内容
*	@unHandleContent	未处理的内容(可能会包含某些奇怪的东西，统统去掉，这里写去除逻辑。可以先调试一条数据试下效果)
*/
function handleContent(unHandleContent) {

	var result = unHandleContent;

	// result = result.replace(/&nbsp;/g,' ');
	// result = result.replace(/\n|\r/g, '<br>');
	// result = result.replace(/<[a-z]{1,6}\s.*\/[a-z]{1,6}>/g, '');
	// result = result.replace(/<br>/g, '\n');

	return result;
}

/**
*	处理分页的章节路径
*	@unHandleUrl	目录中获取到的章节url，通常为章节第一页，计算其他页的url
*	MULTI_PAGE = false 的时候不执行
*/
function handleMultiPageUrl(unHandleUrl) {

	var result = [];

	let reg = /\.html/;
	let index = unHandleUrl.search(reg);
	let url = chapterInfo.link.substring(0, index);

	let url1 = unHandleUrl;
	let url2 = url + '_2.html';
	let url3 = url + '_3.html';

	result.push(url1);
	result.push(url2);
	result.push(url3);

	return result;
}

function sleep(time = 0) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, time);
	})
}

function logd(content) {
	if (DEBUG) {
		console.log(content);
	}
}

/**
*	获取章节列表
*/
function getNovelChapterList() {

	return new Promise(async (resolve, reject) => {

		var tempbrowser;
		for (var i = MAX_RT; i > 0; i--) {

			if (tempbrowser) {
				break;
			}

			console.log('start to init browser...');
			tempbrowser = await puppeteer.launch({
			headless:true,
			args: [
			//'--window-size="800,600"'
			//'--start-fullscreen'
			//'--proxy-server=socks5://127.0.0.1:1080'
			]
			}).catch(ex => {
				if (i-1 > 0) {
					console.log('browser launch failed. now retry...');
				} else {
					console.log('browser launch failed!');
				}
				
			});
		}

		if (!tempbrowser) {
			reject('fail to launch browser');
			return;
		}
		var browser = tempbrowser;

		console.log('start to new page...');
		var page = await browser.newPage().catch(ex=>{
			console.log(ex);
		});
		if (!page) {
			await browser.close().catch();
			reject('fail to open page!');
			return;
		}

		var respond;
		for (var i = MAX_RT; i > 0; i--) {

			if (respond) {
				break;
			}
			
			console.log('start to goto page...');
			respond = await page.goto(CHAPTERS_URL, {
				'waitUntil':'domcontentloaded',
				'timeout':120000
			}).catch(ex=>{
				if(i-1 > 0) {
					console.log('fail to goto website. now retry...');
				} else {
					console.log('fail to goto website!');
				}
				
			});
		}
		if (!respond) {
			await browser.close().catch();
			reject('fail to go to website!');
			return;
		}

		console.log('start to find element in page...');
		var layoutVisible = await page.waitForSelector(CHAPTERS_CSS_SELECTOR).catch(ex=>{
			console.log("oh....no...!!!, i can not see anything!!!");
		});
		if (!layoutVisible) {
			await browser.close().catch();
			reject('layout is invisible!');
			return;
		}
		console.log('yes! layout is visible');

		console.log('start to get info from element...');
		var chapterList;

		for (var i = 0; i < MAX_RT; i++) {

			if (chapterList) {
				break;
			}

			chapterList = await page.evaluate((selector, skip) => {

				let aArr = [...document.querySelectorAll(selector)];
				let result = [];
				for (var i = 0; i < aArr.length; i++) {
					let a = aArr[i];
					let chapter = {
						'num':i+1-skip,
						'name':a.textContent,
						'link':a.href
					}
					result.push(chapter);
				}
				return result;

			}, CHAPTERS_CSS_SELECTOR, CHAPTERS_SKIP).catch(ex=>{
				console.log('fail to query chapter list!' + ex);
				if (i <= MAX_RT-1) {
					console.log('now retry...');
				}
			});
		}

		if (!chapterList) {
			await browser.close().catch();
			reject('fail to query chapter list!');
			return;
		}

		//console.log(chapterList);
		resolve(chapterList);
		//console.log(chapterList);
		console.log('close the browser');
		await browser.close().catch(ex=>{
			console.log('fail to close the browser!');
		});

	});
}

/**
*	获取一页内容
*/
function getPageContent(browser, url) {

	return new Promise(async (resolve, reject) => {

		var page;
		for (var i = 0; i < MAX_RT; i++) {

			if (page) {
				break;
			}

			page = await browser.newPage().catch(ex => {
			});	
		}
		if (!page) {
			console.log(browser + ' fail to open page ' + url);
			reject(url);
			return;
		}

		var respond;
		for (var i = MAX_RT; i > 0; i--) {

			if (respond) {
				break;
			}
			
			respond = await page.goto(url, {
				'waitUntil':'domcontentloaded',
				'timeout':30000
			}).catch(ex=>{});
		}
		if (!respond) {
			await page.close().catch();
			console.log(browser + ' fail to open page ' + url);
			reject(url);
			return;
		}

		var layoutVisible = await page.waitForSelector(CONTENT_CSS_SELECTOR).catch(ex=>{
			console.log("oh....no...!!!, i can not see anything!!!");
		});
		if (!layoutVisible) {
			await page.close().catch();
			console.log('layout is invisible!');
			reject(url);
			return;
		}
		console.log("content see---");

		var exposed = true;
		await page.exposeFunction('handleContent', content => {
			return handleContent(content);
		}).catch(ex=> {
			logd('can not expose function to page!' + ex);
			exposed = false;		
		});
		if (!exposed) {
			reject();
			return;
		} else {
			logd('expose function success!!!')
		}

		var content;
		for (var i = 0; i < MAX_RT; i++) {

			if (content) {
				break;
			}

			content = await page.evaluate(async (selector, resultType, gap) => {

				var element = document.querySelector(selector);

				var result;

				switch(resultType) {
					case 1:{
						result = element.innerHTML;
						break;
					}
					default: {
						result = element.innerText;
					}
				}

				result = await window.handleContent(result).catch(e=>{logd(e);});

				result += gap;

				return result;

			}, CONTENT_CSS_SELECTOR, CONTENT_RESULT_TYPE, GAP_EACH_CHAPTER).catch(ex=>{logd(ex)});
		}

		if (!content) {
			await page.close().catch();
			console.log('fail to query content!');
			reject(url);
			return;
		}

		await page.close().catch();
		resolve(content);
		
	})
		
}

/**
*	获取小说章节内容
*/
function getChapterContent(browser, chapterInfo) {

	return new Promise(async (resolve, reject) => {

		var result;

		if (CONTENT_WITH_CHAPTER_NAME) {
			result = chapterInfo.name + '\n';
		}

		if (MULTI_PAGE) {

			var urls = handleMultiPageUrl(chapterInfo.link);

			for (var i = 0; i < urls.length; i++) {
				var url = urls[i];
				let content = await getPageContent(browser, url).catch(e=>{logd(e);});
				if (!content) {
					reject();
					return;
				}
				result += content;
			}
		} else {

			let content = await getPageContent(browser, chapterInfo.link).catch(e=>{logd(e);});
			if (!content) {
				reject();
				return;
			}
			result += content;
		}

		logd(result);
		resolve(result);
		
	});
}

/**
*	获取代理浏览器
*/
function getProxyBrowser(proxyList) {

	return new Promise(async (resolve, reject) => {

		var browserList = [];

		for (var i = 0; i < proxyList.length; i++) {

			var proxyserver = proxyList[i];
			var proxyOption = proxyserver.version.toLowerCase() + '://' + proxyserver.ip + ':' + proxyserver.port;

			var browser = await puppeteer.launch({
				headless:true,
				args: [
				//'--window-size="800,600"',
				//'--start-fullscreen'
				'--proxy-server='+proxyOption
				]
				}).catch();
			if (browser) {
				browserList.push(browser);
			}
		}

		if (browserList.length == 0) {
			reject()
			return;
		}

		resolve(browserList);
	})
}

/**
*	循环获取章节内容
*/
function loopGetContents(browsers, chapters) {

	return new Promise(async (resolve, reject) => {

		var browserList = browsers;
		var chapterList = chapters;

		var browsersCount = browserList.length;
		var workingFlag = 0;

		async function loop(browser) {

			while(true) {			

				var chapter;
				if (chapterList.length > 0) {
					chapter = chapterList.shift();
				} else {
					if (workingFlag > 0) {
						console.log('alive browser count --> ' + browsersCount + '    working count --> ' + workingFlag);
						await sleep(3000);
						continue;
					} else {
						console.log('all done!');
						browser.close().catch(e=>{});
						browsersCount--;
						break;
					}
				}
				var cIndex = chapter.num;
				var tempPath = TEMP_DIR+chapter.num+'.txt';

				try {
					fs.accessSync(tempPath, fs.constants.F_OK);
					console.log('skip chapter ' + cIndex);
					continue;
				} catch(error) {
				}

				workingFlag++;
				var content = await getChapterContent(browser, chapter).catch(e=>{logd(e);});

				if (content) {
					fsut.savefile(tempPath, content);				
					console.log('the ' + cIndex + ' chapter is saved!');
					workingFlag -= 1;
					await sleep(2000);
				} else {
					console.log('browser dead!');
					chapterList.push(chapter);
					workingFlag -= 1;
					await browser.close().catch(ex=>{logd(ex);});
					browsersCount--;
					break;
				}
				
			}

			if (browsersCount == 0) {
				if (chapterList.length > 0) {
					reject();
				} else {
					resolve('done');
				}
			}
		}

		for (var i = 0; i < browserList.length; i++) {
			loop(browserList[i]);
		}
	})
}

/**
*	执行逻辑
*/
async function run() {

	var chapterList;
	chapterList = await getNovelChapterList().catch(ex=>{logd(ex);});
	if (!chapterList) {		
		console.log("fail to get novel chapter list!!!");
		return;
	}
	for (var i = 0; i < CHAPTERS_SKIP; i++) {
		chapterList.shift();
	}
	logd(chapterList);
	console.log('get chapterList list success');	

	var finishedFlag = MAX_RT;
	while(finishedFlag) {

		if(!DEBUG_1) {

			var proxyList;
			proxyList = await px.getProxyList().catch(ex=>{logd(ex);});
			if (!proxyList) {
				console.log('fail to get proxy list');
				finishedFlag--;
				continue;
			}
			console.log('get proxy list success');
		}
		
	

		var browserList;
		if (DEBUG_1) {

			var tempBrowser = await puppeteer.launch({
			headless:true,
			args: [
			//'--window-size="800,600"'
			//'--start-fullscreen'
			//'--proxy-server=socks5://127.0.0.1:1080'
			]
			}).catch(ex => {
				logd('fail to get browser!');				
			});

			browserList = [];
			browserList.push(tempBrowser);

		} else {
			browserList = await getProxyBrowser(proxyList);
			if (!browserList) {
				console.log('fail to get px browser!');
				finishedFlag--;
				continue;
			}
		}
		console.log('get browserList list success');
		

		if (DEBUG_1) {
			var tempCL = [];
			tempCL.push(chapterList[0]);
			chapterList = tempCL;
		}

		var done = await loopGetContents(browserList, chapterList).catch(ex => {
			logd(ex);
			finishedFlag--;
		});
		if (done) {
			break;
		}

	}

	await fsut.mergeindexfiles(TEMP_DIR, NOVEL_FILE).catch(e=>{
		logd(e);
		console.log('合并文件失败');
	});
	
}

run();