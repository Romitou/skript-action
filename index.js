const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const glob = require('glob');
const {
    stepStart,
    stepComplete,
    stepError
} = require('./logger');

const basePath = path.join(__dirname, 'skript-action');
const tempPath = path.join(basePath, 'temp');
const runnerPath = path.join(basePath, 'runner');
const pluginsPath = path.join(runnerPath, 'plugins');
const skriptPath = path.join(pluginsPath, 'Skript');
const scriptsPath = path.join(skriptPath, 'scripts')

// Action
let skriptFiles;

// Paper
let paperJarPath;
let latestPaperVersion;
let latestPaperBuild;

// Skript
let skriptJarPath;
let latestSkriptRelease;

// Runner
let success = false;

async function setupEnvironnement() {
    stepStart('Setup environnement')

    const skriptInput = core.getInput('scripts');
    skriptFiles = await glob.sync(skriptInput || '*/**/*.sk');
    stepComplete('Scripts found', skriptFiles.join(', '));

    if (await fs.existsSync(skriptPath)) {
        await fs.rmdirSync(skriptPath, { recursive: true });
        stepComplete('Existing scripts and Skript configurations purged')
    }

    await [basePath, tempPath, runnerPath, pluginsPath, skriptPath, scriptsPath]
        .filter(path => !fs.existsSync(path))
        .forEach(path => fs.mkdirSync(path));
    stepComplete('Environnement created')

}

async function fetchLatestSkript() {
    stepStart('Fetch latest Skript release')
    const { data: response } = await axios.get('https://api.github.com/repos/SkriptLang/Skript/releases/latest');
    latestSkriptRelease = response;
    if (!latestSkriptRelease)
        stepError('Cannot fetch latest Skript release!');
    skriptJarPath = path.join(tempPath, `Skript-${latestSkriptRelease.tag_name}.jar`)
    stepComplete('Fetched release', latestSkriptRelease.html_url)
}

async function downloadSkript() {
    stepStart('Download Skript plugin')
    if (await fs.existsSync(skriptJarPath))
        return stepComplete('Download skipped', `Skript v${latestSkriptRelease.tag_name} was already downloaded!`)
    const downloadUrl = latestSkriptRelease.assets[0].browser_download_url;
    if (!downloadUrl)
        stepError('Cannot retrieve Skript browser download URL from latest Skript release!');
    const writer = fs.createWriteStream(skriptJarPath);
    const { data: skriptJar } = await axios.get(downloadUrl, { responseType: 'stream' });
    await skriptJar.pipe(writer);
    return new Promise(resolve => writer.on('finish', resolve));
}

async function fetchLatestPaper() {
    stepStart('Fetch latest Paper version')

    const { data: latestVersions } = await axios.get('https://papermc.io/api/v2/projects/paper', { headers: { 'content-type': 'application/json' } });
    if (!latestVersions || !latestVersions.versions)
        stepError('Cannot fetch latest Paper version!')
    latestPaperVersion = latestVersions.versions[latestVersions.versions.length - 1];
    stepComplete('Fetched version', latestPaperVersion)

    const { data: latestBuilds } = await axios.get(`https://papermc.io/api/v2/projects/paper/versions/${latestPaperVersion}`, { headers: { 'content-type': 'application/json' } })
    if (!latestBuilds || !latestBuilds.builds)
        stepError(`Cannot fetch latest Paper build for ${latestPaperVersion}!`)
    latestPaperBuild = latestBuilds.builds[latestBuilds.builds.length - 1];
    paperJarPath = path.join(tempPath, `paper-${latestPaperVersion}-${latestPaperBuild}.jar`)
    stepComplete('Fetched build', `#${latestPaperBuild}`)
}

async function downloadPaper() {
    stepStart('Download Paper software')
    if (await fs.existsSync(paperJarPath))
        return stepComplete('Download skipped', `Paper ${latestPaperVersion}, build #${latestPaperBuild} was already downloaded!`)
    const writer = fs.createWriteStream(paperJarPath);
    const { data: paperJar } = await axios.get(`https://papermc.io/api/v2/projects/paper/versions/${latestPaperVersion}/builds/${latestPaperBuild}/downloads/paper-${latestPaperVersion}-${latestPaperBuild}.jar`, { responseType: 'stream' })
    await paperJar.pipe(writer);
    return new Promise(resolve => writer.on('finish', resolve));
}

async function setupRunner() {
    stepStart('Setup runner')

    await fs.copyFileSync(paperJarPath, path.join(runnerPath, path.basename(paperJarPath)));
    stepComplete('Paper software moved into runner')

    await fs.copyFileSync(skriptJarPath, path.join(pluginsPath, path.basename(skriptJarPath)));
    stepComplete('Skript plugin moved into runner\'s plugins')

    await skriptFiles.forEach(script => fs.copyFileSync(script, path.join(scriptsPath, path.basename(script))));
    stepComplete('Scripts moved into runner\'s Skript folder')
}

async function parseStdout(data) {
    if (data.toString().includes('[Skript] Loading Skript')) {
        stepComplete('Skript loaded!')
    } else if (data.toString().includes('[Skript] All scripts loaded without errors.')) {
        stepComplete('No errors found while parsing!')
        success = true;
    } else if (data.toString().includes('[Skript] Finished loading.')) {
        if (success) {
            stepComplete('All good. Exiting!')
            process.exit(0);
        } else {
            stepError('Parse errors have occurred!')
        }
    }
}

async function startRunner() {
    stepStart('Starting runner...');
    await exec.exec('java', [
        '-jar',
        '-Dcom.mojang.eula.agree=true',
        path.basename(path.join(pluginsPath, path.basename(paperJarPath))),
        '--nogui'
    ], {
        cwd: runnerPath,
        listeners: {
            stdout: (data) => parseStdout(data),
            stderr: (data) => parseStdout(data)
        }
    })
}

async function run() {
    await setupEnvironnement();

    await fetchLatestSkript();
    await downloadSkript();
    stepComplete('Skript downloaded', `Skript v${latestSkriptRelease.tag_name} has been downloaded!`);

    await fetchLatestPaper();
    await downloadPaper();
    stepComplete('Paper downloaded', `Paper ${latestPaperVersion}, build #${latestPaperBuild} has been downloaded!`)

    await setupRunner();
    await startRunner();
}
