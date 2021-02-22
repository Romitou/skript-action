const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const {
    stepStart,
    stepComplete,
    stepError
} = require('./logger');

const basePath = path.join(__dirname, 'skript-action');
const tempPath = path.join(basePath, 'temp');
const runnerPath = path.join(basePath, 'runners');
const octokit = new Octokit();
let skriptJarPath;
let latestRelease;

async function downloadSkript() {
    stepStart('Download Skript plugin')
    if (await fs.existsSync(skriptJarPath))
        return stepComplete('Download skipped', `Skript v${latestRelease.tag_name} was already downloaded!`)
    const downloadUrl = latestRelease?.assets[0]?.browser_download_url;
    if (!downloadUrl)
        stepError('Cannot retrieve Skript browser download URL from latest Skript release!');
    const skriptJar = await octokit.request(downloadUrl);
    await fs.appendFileSync(skriptJarPath, Buffer.from(skriptJar.data));
    stepComplete('Skript downloaded', `Skript v${latestRelease.tag_name} has been downloaded!`)
}

async function fetchLatestRelease() {
    stepStart('Fetch latest Skript release')
    const { data } = await octokit.repos.getLatestRelease({
        owner: 'SkriptLang',
        repo: 'Skript',
    });
    latestRelease = data;
    if (!latestRelease)
        stepError('Cannot fetch latest Skript release!');
    skriptJarPath = path.join(tempPath, `Skript-${latestRelease.tag_name}.jar`)
    stepComplete('Fetched release', latestRelease.html_url)
}

async function createFolders() {
    stepStart('Setup environnement')
    await [basePath, tempPath, runnerPath]
        .filter(path => !fs.existsSync(path))
        .forEach(path => fs.mkdirSync(path));
    stepComplete('Environment ready')
}

async function run() {
    await createFolders();
    await fetchLatestRelease();
    await downloadSkript();
}
