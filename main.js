const inquirer = require("inquirer");
const ytdl = require("ytdl-core");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const cliProgress = require("cli-progress");
const ytsr = require("ytsr");
const duration = require("get-video-duration").getVideoDurationInSeconds;
const format_seconds = require("format-duration");
const player = require("play-sound")((opts = {}));
const { exec } = require("child_process");

//TODO REMEMBER TO ADD GO_BACK FUNCTIONALITY TO ALL PROMPTS
//TODO add file browsing
//TODO add play file functionality
//TODO if there is time left play around with ascii videos

console.log("hi, welcome to the youtube downloader");

// Questions {{{

const download_options = {
	title: "",
	channel: "",
	format: "",
	quality: ""
};

const tracker = {
	video: 0,
	audio: 0,
	finished: false
};

const q_first = {
	type: "list",
	name: "q",
	message: "what would you like to do?",
	choices: [
		"Search for a video",
		"Browse downloaded files",
		new inquirer.Separator(),
		"Exit app"
	]
};

const q_search_options = {
	type: "list",
	name: "q",
	message: "do you have an existing url or do you want to search youtube?",
	choices: [
		"Existing url",
		"Search youtube",
		new inquirer.Separator(),
		"Back"
	]
};

const q_browse_options = {
	type: "list",
	name: "q",
	message: "Which library would you like to view?",
	choices: ["-- GO BACK --", "Video Library", "Audio Library"]
};

const q_browse_files = {
	type: "list",
	name: "q",
	message: "Files",
	choices: [],
	pageSize: 30,
	loop: false
};

const q_url_search = {
	type: "input",
	name: "q",
	message: "Enter youtube video url (q to go back): "
};

const q_video_search = {
	type: "input",
	name: "q",
	message: "Enter search query (--q to go back): "
};

const q_video_choice = {
	type: "list",
	name: "q",
	message: "Videos",
	choices: [],
	pageSize: 30,
	loop: false
};

const q_format = {
	type: "list",
	name: "q",
	message: "Would you like to download in video or audio format?",
	choices: ["Video", "Audio", new inquirer.Separator(), "Cancel"],
	loop: false
};

let options = {};
var q_video_quality = {
	type: "list",
	name: "q",
	message: "Choose a quality:",
	choices: Object.keys(options),
	pageSize: 15,
	loop: false
};

// const q_after_download = {};

// }}}

// Prompts {{{

function first() {
	console.clear();
	inquirer.prompt(q_first).then((answer) => {
		if (answer.q == q_first.choices[0]) search_options();
		else if (answer.q == q_first.choices[1]) browse_options();
		else console.clear();
	});
}

function search_options() {
	console.clear();
	inquirer.prompt(q_search_options).then((answer) => {
		if (answer.q == q_search_options.choices[0]) url_search();
		else if (answer.q == q_search_options.choices[1]) video_search();
		else first();
	});
}

function browse_options() {
	console.clear();
	inquirer.prompt(q_browse_options).then((answer) => {
		if (answer.q == q_browse_options.choices[0]) first();
		else if (answer.q == q_browse_options.choices[1])
			load_files_from_dir("videos");
		else if (answer.q == q_browse_options.choices[2])
			load_files_from_dir("audio");
	});
}

function browse_files(dir) {
	console.clear();
	inquirer.prompt(q_browse_files).then((answer) => {
		console.log("answer: " + answer.q);
		if (answer.q == "-- GO BACK --") browse_options();
		else play_file(dir, answer.q);
	});
}

function url_search() {
	console.clear();
	inquirer.prompt(q_url_search).then((answer) => {
		if (answer.q == "q") search_options();
		else handle_url(answer.q);
	});
}

function video_search() {
	inquirer.prompt(q_video_search).then((answer) => {
		if (answer.q == "--q") search_options();
		else handle_search(answer.q);
	});
}

function video_choice() {
	inquirer.prompt(q_video_choice).then((answer) => {
		if (answer.q == "-- GO BACK --") search_options();
		else handle_url(answer.q.url);
	});
}

function format(url, title) {
	inquirer.prompt(q_format).then((answer) => {
		download_options.format = answer.q;
		if (answer.q == q_format.choices[0]) video_quality(url, title);
		else if (answer.q == q_format.choices[1]) download_audio(url, title);
		else first();
	});
}

function video_quality(url, title) {
	inquirer.prompt(q_video_quality).then((answer) => {
		if (answer.q == "Cancel") first();
		else {
			download_options.quality = answer.q;
			let chosen_format = options[answer.q];
			download_video(url, title, chosen_format);
		}
	});
}

// function after_download() {
// 	inquirer.prompt(q_after_download).then((answer) => {

// 	});
// }

// }}}

// Backend Functionality {{{

const osp = process.platform;

function play_file(dir, file) {
	let f_path = path.join(__dirname, "downloads", dir, file);

	if (osp == "linux") {
		// player.play(f_path, function (err) {
		// 	if (err) throw err;
		// });
		exec(`mpv "${f_path}"`);
	} else if (osp == "win32") {
		exec(`"${f_path}"`);
	}
	browse_files(dir);
}

async function load_files_from_dir(dir) {
	let f_path = path.join(__dirname, "downloads", dir);
	console.clear();
	console.log("Retreiving files...");
	q_browse_files.choices = [new inquirer.Separator(), "-- GO BACK --"];
	let files = fs.readdirSync(f_path);
	console.log("Parsing...");
	files.splice(files.indexOf(".gitkeep"), 1);
	q_browse_files.choices.push(new inquirer.Separator());
	for (const file of files) {
		const dur = await duration(path.join(f_path, file));
		let display_name = file + "\n  Duration: " + format_seconds(dur * 1000);
		q_browse_files.choices.push({
			name: display_name,
			value: file,
			short: file
		});
		q_browse_files.choices.push(new inquirer.Separator());
	}
	browse_files(dir);
}

function download_audio(url, title) {
	tracker.video = 0;
	tracker.audio = 0;

	const download_bar = new cliProgress.SingleBar(
		{
			format: "downloading | {bar} {percentage}%",
			clearOnComplete: true,
			hideCursor: true
		},
		cliProgress.Presets.shades_classic
	);

	download_bar.start(100, 0);

	const audio = ytdl(url, {
		filter: "audioonly",
		quality: "highestaudio"
	})
		.on("progress", (_, downloaded, total) => {
			let progress = Math.round((downloaded / total) * 100);
			if (progress != tracker.audio) {
				tracker.audio = progress;
				download_bar.update(tracker.audio);
				// display_download();
			}
		})
		.on("error", (err) => {
			download_bar.stop();
			console.log("Download Failed. Returning to Main Manu");
			first();
		});

	let tempPath = path.join(__dirname, "downloads", "audio");

	audio.pipe(fs.createWriteStream(path.join(tempPath, title + ".mp3")));

	audio.on("finish", function () {
		tracker.finished = true;
		download_bar.stop();
		first();
	});
}

function download_video(vidURL, vidTitle, vidFormat) {
	console.clear();
	display_download_options();

	tracker.video = 0;
	tracker.audio = 0;

	const download_bar = new cliProgress.SingleBar(
		{
			format: "downloading | {bar} {percentage}%",
			clearOnComplete: true,
			hideCursor: true
		},
		cliProgress.Presets.shades_classic
	);

	download_bar.start(200, 0);

	const video = ytdl(vidURL, { filter: "videoonly", quality: vidFormat })
		.on("progress", (_, downloaded, total) => {
			let progress = Math.round((downloaded / total) * 100);
			if (progress != tracker.video) {
				tracker.video = progress;
				download_bar.update(tracker.video + tracker.audio);
				// display_download();
			}
		})
		.on("error", (err) => {
			download_bar.stop();
			console.log("Download Failed. Returning to Main Manu");
			first();
		});
	const audio = ytdl(vidURL, {
		filter: "audioonly",
		quality: "highestaudio"
	})
		.on("progress", (_, downloaded, total) => {
			let progress = Math.round((downloaded / total) * 100);
			if (progress != tracker.audio) {
				tracker.audio = progress;
				download_bar.update(tracker.video + tracker.audio);
				// display_download();
			}
		})
		.on("error", (err) => {
			download_bar.stop();
			console.log("Download Failed. Returning to Main Manu");
			first();
		});

	let tempPath = path.join(__dirname, "downloads");

	video.pipe(fs.createWriteStream(path.join(tempPath, vidTitle + ".mp4")));
	audio.pipe(fs.createWriteStream(path.join(tempPath, vidTitle + ".mp3")));

	video.on("finish", function () {
		tracker.video = 101;
		if (tracker.audio == 101) {
			tracker.finished = true;
			download_bar.stop();
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
			download_bar.stop();
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
			first();
		})
		.run();
}

function handle_url(url) {
	console.clear();
	options = {};
	ytdl.getInfo(url)
		.then((info) => {
			//Display info
			console.log(" -- VIDEO INFORMATION --");
			console.log("Title: " + info.videoDetails.title);
			console.log("Channel: " + info.videoDetails.author.name);

			//extract formats
			for (let i = 0; i < info.formats.length; i++) {
				let format = info.formats[i];
				if (format.container != "mp4") continue;
				// if (![134, 135, 298, 299].includes(format.itag)) continue;
				if ([18, 140].includes(format.itag)) continue;
				let key = format.container + " - " + format.qualityLabel;
				options[key] = format.itag;
			}
			q_video_quality.choices = Object.keys(options);
			q_video_quality.choices.push(new inquirer.Separator());
			q_video_quality.choices.push("Cancel");

			download_options.title = info.videoDetails.title;
			download_options.channel = info.videoDetails.author.name;
			format(url, info.videoDetails.title);
		})
		.catch(function () {
			//TODO ask if they want to search instead and call handle_search()
			console.log("Invalid url. Redirecting...");
			setTimeout(() => {
				search_options();
			}, 1000);
		});
}

async function handle_search(search) {
	console.clear();
	q_video_choice.choices = [new inquirer.Separator(), "-- GO BACK --"];
	console.log("searching...");

	let filters = await ytsr.getFilters(search);
	let filter = filters.get("Type").get("Video");

	console.log("retrieving results...");
	ytsr(filter.url, { limit: 30 }).then((results) => {
		console.clear();
		q_video_choice.choices.push(new inquirer.Separator());
		results.items.forEach((result) => {
			var vid = {
				name:
					"Title: " +
					result.title +
					"\n  Channel: " +
					result.author.name +
					"\n  Duration: " +
					result.duration,
				value: result,
				short: result.title
			};
			q_video_choice.choices.push(vid);
			q_video_choice.choices.push(new inquirer.Separator());
		});
		video_choice();
	});
}

// }}}

first();
