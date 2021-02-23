const chalk = require('chalk');

/**
 * @param stepName Name of the step
 */
function stepStart(stepName) {
    console.log();
    console.log(chalk.gray('==>') + ' ' + chalk.whiteBright(stepName));
}

/**
 * @param stepName    Name of the step
 * @param description Description of the step
 */
function stepComplete(stepName, description) {
    console.log(chalk.greenBright(' ✔ ') + ' ' + chalk.blue(stepName) + (description ? ' ' + chalk.gray(description) : ''));
}

/**
 * @param error Error of the step
 */
function stepError(error) {
    console.log(chalk.redBright(' ❌ ') + ' ' + chalk.red(error));
    process.exit(0);
}

module.exports = {
    stepStart,
    stepComplete,
    stepError
};
