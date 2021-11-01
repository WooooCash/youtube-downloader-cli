const inquirer = require("inquirer");
const ytdl = require("ytdl-core");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const cliProgress = require("cli-progress");

//REMEMBER TO ADD GO_BACK FUNCTIONALITY TO ALL PROMPTS
console.log("hi, welcome to the youtube downloader");

const download_options = {
	title: "",
	channel: "",
	format: "",
	quality: "",
};

const tracker = {
	video: 0,
	audio: 0,
	finished: false,
};

const q_first = {
	type: "list",
	name: "q",
	message: "what would you like to do?",
	choices: ["Search for a video", "Browse downloaded files", "Exit app"],
};

const q_search_options = {
	type: "list",
	name: "q",
	message: "do you have an existing url or do you want to search youtube?",
	choices: ["Existing url", "Search youtube", "Go Back"],
};

const q_url_search = {
	type: "input",
	name: "q",
	message: "Enter youtube video url",
};

const q_video_search = {
	type: "input",
	name: "q",
	message: "Enter search query",
};

const q_video_choice = {};

const q_format = {
	type: "list",
	name: "q",
	message: "Would you like to download in video or audio format?",
	choices: ["Video", "Audio"],
};

let options = {};
var q_video_quality = {
	type: "list",
	name: "q",
	message: "Choose a quality:",
	choices: Object.keys(options),
};

const q_after_download = {};

function first() {
	console.clear();
	inquirer.prompt(q_first).then((answer) => {
		if (answer.q == "Search for a video") search_options();
	});
}

function search_options() {
	console.clear();
	//second prompt
	inquirer.prompt(q_search_options).then((answer) => {
		//console.log(JSON.stringify(answer, null, ' '));
		if (answer.q == "Existing url") url_search();
		else if (answer.q == "Search for a video") video_search();
		else if (answer.q == "Go Back") first();
	});
}

function url_search() {
	console.clear();
	inquirer.prompt(q_url_search).then((answer) => {
		handle_url(answer.q);
	});
}

function video_search() {
	inquirer.prompt(q_video_search).then((answer) => {
		handle_search(answer.q);
	});
}

function video_choice() {}

function format(url, title) {
	console.log("format");
	inquirer.prompt(q_format).then((answer) => {
		download_options.format = answer.q;
		if (answer.q == "Video") video_quality(url, title);
		else if (answer.q == "Audio") download_audio(url, title);
	});
}

function video_quality(url, title) {
	inquirer.prompt(q_video_quality).then((answer) => {
		download_options.quality = answer.q;
		let chosen_format = options[answer.q];
		download_video(url, title, chosen_format);
	});
}

function download_video(vidURL, vidTitle, vidFormat) {
	console.clear();
	display_download_options();

	const multibar = new cliProgress.MultiBar(
		{
			clearOnComplete: true,
			hideCursor: true,
		},
		cliProgress.Presets.shades_classic
	);

	const vidBar = multibar.create(100, 0);
	const audBar = multibar.create(100, 0);

	const video = ytdl(vidURL, { filter: "videoonly", quality: vidFormat }).on(
		"progress",
		(_, downloaded, total) => {
			let progress = Math.round((downloaded / total) * 100);
			if (progress != tracker.video) {
				tracker.video = progress;
				vidBar.update(tracker.video);
				// display_download();
			}
		}
	);
	const audio = ytdl(vidURL, {
		filter: "audioonly",
		quality: "highestaudio",
	}).on("progress", (_, downloaded, total) => {
		let progress = Math.round((downloaded / total) * 100);
		if (progress != tracker.audio) {
			tracker.audio = progress;
			audBar.update(tracker.audio);
			// display_download();
		}
	});

	let tempPath = path.join(__dirname, "downloads");

	video.pipe(fs.createWriteStream(path.join(tempPath, vidTitle + ".mp4")));
	audio.pipe(fs.createWriteStream(path.join(tempPath, vidTitle + ".mp3")));

	video.on("finish", function () {
		tracker.video = 101;
		if (tracker.audio == 101) {
			tracker.finished = true;
			multibar.stop();
			mergeFiles(
				path.join(tempPath, vidTitle + ".mp4"),
				path.join(tempPath, vidTitle + ".mp3"),
				path.join(tempPath, "videos", vidTitle + ".mp4")
			);
		}
	});
	audio.on("finish", function () {
		tracker.audio = 101;
		if (tracker.video == 101) {
			tracker.finished = true;
			multibar.stop();
			mergeFiles(
				path.join(tempPath, vidTitle + ".mp4"),
				path.join(tempPath, vidTitle + ".mp3"),
				path.join(tempPath, "videos", vidTitle + ".mp4")
			);
		}
	});
}

function display_download_options() {
	console.log("------------------- Downloading --------------------");
	console.log("Title: " + download_options.title);
	console.log("Channel: " + download_options.channel);
	console.log("Format: " + download_options.format);
	if (download_options.quality != "")
		console.log("Quality: " + download_options.quality);
	console.log("----------------------------------------------------");
}

function mergeFiles(vPath, aPath, oPath) {
	console.log("merging...");
	ffmpeg()
		.addInput(vPath)
		.addInput(aPath)
		.output(oPath)
		.on("end", function () {
			console.log("finished processing");
			fs.unlink(vPath, (err) => {
				if (err) console.log(err);
			});
			fs.unlink(aPath, (err) => {
				if (err) console.log(err);
			});
		})
		.run();
}

function after_download() {}

function handle_url(url) {
	options = {};
	ytdl
		.getInfo(url)
		.then((info) => {
			//Display info
			console.log(" -- VIDEO INFORMATION --");
			console.log("Title: " + info.videoDetails.title);
			console.log("Channel: " + info.videoDetails.author.name);

			//extract formats
			for (let i = 0; i < info.formats.length; i++) {
				let format = info.formats[i];
				if (format.container != "mp4") continue;
				if (![134, 135, 298, 299].includes(format.itag)) continue;
				let key = format.container + " - " + format.qualityLabel;
				options[key] = format.itag;
				q_video_quality.choices = Object.keys(options);
			}
			download_options.title = info.videoDetails.title;
			download_options.channel = info.videoDetails.author.name;
			format(url, info.videoDetails.title);
		})
		.catch(function () {
			//ask if they want to search instead and call handle_search()
		});
}

first();
