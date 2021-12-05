# Youtube Downloader CLI

## Description

This is a youtube downloader app which uses the command line. Download youtube videos in either mp3 or mp4 format to a local library.
(Note, some ui features may not work in Windows cmd. Use powershell instead.)

## Install

### Download ffmpeg

**Linux**:

download ffmpeg from your distribution's package manager

apt manager example:
```
sudo apt-get install ffmpeg
```

**Windows**:

Download ffmpeg binaries from https://www.gyan.dev/ffmpeg/builds/ (I recommend *ffmpeg-release-essentials* in zip or 7z format)

Extract files to desired location

Add the *bin* folder to Path in your system environment variables


### Download the project

Clone the project

```
git clone https://github.com/WooooCash/youtube-downloader-cli
```

Install dependencies

```
cd youtube-downloader-cli
```
```
npm install
```

## Running the app

To start the app use

```
npm start
```

## Additional info

Downloaded videos can be found in **./downloads/videos/** and audiofile can be found in **./downloads/audio/**

:)
