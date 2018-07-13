const fs = require('fs')
const path = require('path')

async function mkdirs(dir, callback) {

	var absolutePath = path.resolve(dir);
	var currentDir;
	if (path.extname(absolutePath)) {
		currentDir = path.dirname(absolutePath);
	} else {
		currentDir = dir;
	}
	
	//console.log('now make dir ---->' + currentDir);
	fs.mkdir(currentDir, err => {

		if (err) {
			if (err.code === 'EEXIST') {
				//console.log('dir exists back! ---->' + currentDir);
				callback();
			} else if (err.code === 'ENOENT') {

				//console.log('parent dir not exists');
				mkdirs(path.dirname(currentDir), e => {
					if (e) {
						callback(e);
					} else {
						mkdirs(dir, callback);
					}
				});

			} else {
				console.log(err);
				callback(err);
			}
		} else {
			callback();
		}
		
	
	});
}

async function saveToFile(file, content) {	

	return new Promise((resolve, reject) => {

		var parentPath;
		if (path.extname(file)) {
			parentPath = path.dirname(file);
		} else {
			parentPath = path.dirname(file);
		}

		mkdirs(parentPath, err => {

			if (err) {
				reject(err);
				return;
			}

			fs.writeFile(file, content, {flag:"a"}, err1 => {

				if (err1) {
					reject(err);
				} else {
					resolve();
				}

			});

		})
		
	});
}

function mergeAllIndexFiles(srcdir, dstfile) {

	return new Promise((resolve, reject) => {

		fs.readdir(srcdir, (err, files) => {

			if (err) {
				reject();
				return;
			}

			var fileCount = files.length;
			console.log('all files ----> ' + fileCount);

			var write = fs.createWriteStream(dstfile, {'flag':'a'});
			write.on('error', err1=>{
				write.end();
				reject(err1);
			})

			var currentIndex = 1;

			function append() {

				var file = `${srcdir}${currentIndex}.txt`;
				var readStream = fs.createReadStream(file, {'encoding':'utf8'});
				readStream.on('error', err1=>{
					write.end();
					reject(err1);
				})
				readStream.on('end', ()=>{
					currentIndex++;
					if (currentIndex <= fileCount) {
						append();
					} else {
						write.end();
						resolve('done!');
					}
				})				
				readStream.pipe(write, {end: false});
			}
			append();
			
		})

	})
}

// (async ()=> {
// 	var rs = await mergeAllIndexFiles('./绝望游戏/', './绝望游戏.txt').catch(ex=>{
// 		console.log(ex);
// 	});
// 	console.log(rs);
// })()



module.exports.savefile = saveToFile;
module.exports.mkdirs = mkdirs;
module.exports.mergeindexfiles = mergeAllIndexFiles;