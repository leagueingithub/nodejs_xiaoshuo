const puppeteer = require('puppeteer')

//max retry times
const MAX_RT = 3;

function getproxylist() {

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
			//'--proxy-server=socks5://127.0.0.1:12580'
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
		const browser = tempbrowser;

		console.log('start to new page...');
		var page = await browser.newPage().catch(ex=>{
			console.log(ex);
		});
		if (!page) {
			reject('fail to open page!');
			return;
		}

		var respond;
		for (var i = MAX_RT; i > 0; i--) {

			if (respond) {
				break;
			}
			
			console.log('start to goto page...');
			respond = await page.goto("http://31f.cn/socks-proxy/", {
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
			reject('fail to go to website!');
			return;
		}

		console.log('start to find element in page...');
		var layoutVisible = await page.waitForSelector('body > div > table.table.table-striped > tbody').catch(ex=>{
			console.log("oh....no...!!!, i can not see anything!!!");
		});
		if (!layoutVisible) {
			reject('layout is invisible!');
			return;
		}

		//haha is Array<JSHandle>
		// var haha = await page.$$('.container table tbody tr');

		// console.log('haha:'+Object.prototype.toString.call(haha));

		// var bb = haha[0];
		// console.log('bb:'+Object.prototype.toString.call(bb));

		// try {
		// 	var json = await bb.jsonValue();
		// 	console.log(json);
		// 	console.log(bb.toString());
		// 	var properties = await bb.getProperties();
		// 	console.log(properties);
		// 	var jjson = await properties.jsonValue();
		// 	console.log(jjson);
		// 	var jproperties = await properties.getProperties();			
		// 	console.log(jproperties);
		// } catch(e) {

		// }

		console.log('start to get info from element...');
		var proxyModelArray = await page.evaluate(async () => {

			//let list1 = document.querySelectorAll('.container table tbody tr');//list1 -- NodeList
			//let list2 = [...document.querySelectorAll('.container table tbody tr')];//list2 --Array<HTMLTableRowElement>
			//let list3 = Array.from(document.querySelectorAll('.container table tbody tr'));//list --same of list2

			//let element1 = list1[0];
			//let element2 = list2[0];
			//let element3 = list3[0];

			let list = document.querySelectorAll('body > div > table.table.table-striped > tbody > tr ~ tr');
			if (!list) {
				return;
			}
			let result = [];

			for (var i = 0; i < list.length; i++) {
				var row = list[i];
				var cells = row.cells;

				var ip = cells[1].textContent;
				var port = cells[2].textContent;
				var code = cells[4].textContent;
				var version = cells[6].textContent;

				var proxyServerModel = {
					'ip' : ip,
					'port' : port,
					'code' : code,
					'version' : version
				}
				result.push(proxyServerModel);				
			}
			return result;
			// return {
			// 	'list1':Object.prototype.toString.call(list1),
			// 	'list2':Object.prototype.toString.call(list2),
			// 	'list3':Object.prototype.toString.call(list3),
			// 	'element1':Object.prototype.toString.call(element1),
			// 	'element2':Object.prototype.toString.call(element2),
			// 	'element3':Object.prototype.toString.call(element3),
			// 	'cells':element1.cells[0].textContent
			// }

			// let arr = [];
			// for (var i = 0; i < list.length; i++) {
			// 	let elementHandle = list[i];

			// 	let json = elementHandle.innerText;
			// 	arr.push(json);
			// }

			// return arr;

		});

		await browser.close().catch(ex=>{
			console.log('fail to close the browser!');
		});
		console.log('close the browser');

		//console.log(proxyModelArray);
		if (!proxyModelArray || proxyModelArray.length === 0) {
			reject();
			return;
		}
		resolve(proxyModelArray);
		
		
	})	
}

async function getProxyBrowser(checkurl, rtc = 3) {

	return new Promise(async (resolve, reject) => {

		var proxyList = await getproxylist().catch();
		if (!proxyList) {
			reject();
			return;
		}

		var browserList = [];

		for (var i = 0; i < 3; i++) {

			var proxyserver = proxyList[i];
			var proxyOption = proxyserver.version.toLowerCase() + '://' + proxyserver.ip + ':' + proxyserver.port;

			var browser = await puppeteer.launch({
				headless:false,
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

async function test() {

	var proxylist;
	for (var i = 0; i < MAX_RT; i++) {

		if (proxylist) {
			break;
		}

		console.log('start get proxylist from web...');
		proxylist = await getproxylist().catch(ex=> {
			if (i+1<MAX_RT) {
				console.log('fail to get proxylist. now retry...');
			} else {
				console.log('fail to get proxylist. end!!!');
			}
		});
	}
			
	
	// var ip = proxylist[0].ip;
	// console.log(ip);
	if (!proxylist) {
		console.log('fail to get proxylist!!!');
		return;
	}
	console.log(proxylist);
}

// async function test() {

// 	var browsers;

// 	browsers = await getProxyBrowser().catch(e=>{console.log('no browser get!');});

// 	if (!browsers) {
// 		console.log('fail to get proxylist!!!');
// 		return;
// 	}

// 	for (i = 0; i < browsers.length; i++) {
// 		var browser = browsers[i];
// 		console.log(browser);
// 		var page = await browser.newPage();
// 		page.goto('https://www.google.com');
// 	}
// }

// test();

module.exports.getProxyList = getproxylist;
