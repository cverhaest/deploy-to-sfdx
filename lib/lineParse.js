const fs = require('fs');
const logger = require('heroku-logger');
const readline = require('readline');

const shellSanitize = require('./shellSanitize');
const bufferKey = require('./bufferKey');

const ex = 'deployMsg';

module.exports = function(msgJSON, ch, visitor){
	logger.debug('line parsing started');


	return new Promise(function (resolve, reject){
		const parsedLines = [];
		let noFail = true;
		const rl = readline.createInterface({
			input: fs.createReadStream(`tmp/${msgJSON.deployId}/orgInit.sh`),
			terminal: false
		}).on('line', (line) => {
			logger.debug(`Line: ${line}`);
			if (msgJSON.whitelisted){
				// if the user or repo is on the whitelist, we'll let you execute whatever you like!
				parsedLines.push(`cd tmp;cd ${msgJSON.deployId};${line}`);
			} else if (!shellSanitize(line)) {
				// otherwise, we're goign to inspect your code very carefully
				ch.publish(ex, '', bufferKey(`ERROR: Commands with metacharacters cannot be executed.  Put each command on a separate line.  Your command: ${line}`, msgJSON.deployId));
				noFail = false;
				rl.close();
				visitor.event('Repo Problems', 'line with semicolons', msgJSON.template).send();
			} else if (!line) {
				logger.debug('empty line');
			} else if (line.startsWith('#!/bin/bash')) {
				logger.debug('bash line.  Ignoring!');
			} else if (line.includes('-u ')) {
				logger.debug('found a -u in a command line');
				ch.publish(ex, '', bufferKey(`ERROR: Commands can't contain -u...you can only execute commands against the default project the deployer creates--this is a multitenant sfdx deployer.  Your command: ${line}`, msgJSON.deployId));
				noFail = false;
				rl.close();
				visitor.event('Repo Problems', 'line with -u', msgJSON.template).send();
			} else if (!line.startsWith('sfdx') && !line.startsWith('#')) {
				ch.publish(ex, '', bufferKey(`ERROR: Commands must start with sfdx or be comments (security, yo!).  Your command: ${line}`, msgJSON.deployId));
				noFail = false;
				rl.close();
				visitor.event('Repo Problems', 'non-sfdx line', msgJSON.template).send();
			} else {
				logger.debug('line pushed');
			/*	if(typeof msgJSON.accessToken!='undefined' && msgJSON.accessToken!='')
				{
					line=line+' -u '+msgJSON.accessToken;
					if(parsedLines[0]!='cd tmp;cd '+msgJSON.deployId+';sfdx force:config:set instanceUrl='+msgJSON.instanceUrl){
						parsedLines.unshift('cd tmp;cd '+msgJSON.deployId+';sfdx force:config:set instanceUrl='+msgJSON.instanceUrl);
					}
				}*/
				if(typeof msgJSON.SOusername!='undefined' && msgJSON.SOusername!='')
				{
					line=line+' -u '+msgJSON.SOusername;
				}

				parsedLines.push(`cd tmp;cd ${msgJSON.deployId};${line}`);
			}
		}).on('close', () => {
			// you have all the parsed lines
			logger.debug('in the close event');
			logger.debug(parsedLines);
			if (noFail) {
				resolve(parsedLines);
			} else {
				reject('line parsing errors');
			}
		});
	});
};