const logger = require('heroku-logger');
const exec = require('child-process-promise').exec;
const bufferKey = require('./bufferKey');
const argStripper = require('./argStripper');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

const ex = 'deployMsg';

const fs = require('fs');

module.exports = function (msgJSON, lines, ch, visitor) {
	this.msgJSON = msgJSON;
	this.lines = lines;
	this.ch = ch;
	this.visitor = visitor;
	this.runLines = async function runLines() {

		//before running the lines, import the org details with auth if we have a username
		if(typeof this.msgJSON.SOusername!='undefined'){
			let orgdetails=await redis.get(this.msgJSON.SOusername);
			//logger.debug("ORGDETAILS:"+this.msgJSON.SOusername+" "+orgdetails); //this log exposes credentials in the log...
			if(typeof orgdetails!='undefined'){
				
				orgdetails=JSON.parse(orgdetails);
				if (process.env.DXLOGINURL)
				{   
					fs.writeFileSync('/app/tmp/'+this.msgJSON.deployId+'.txt', orgdetails.sfdxAuthUrl, 'utf8');
					this.lines.unshift(`cd tmp;cd ${this.msgJSON.deployId};sfdx force:auth:sfdxurl:store -f `+'/app/tmp/'+this.msgJSON.deployId+'.txt')
				}
			}
		}
		
		logger.debug('starting the line runs');
		for (let line of this.lines) {
			let localLine = line;
			logger.debug('localline: '+localLine);
			// corrections and improvements for individual commands
		/*	if (localLine.includes('sfdx force:auth:jwt:grant')) {
				logger.debug(`org auth command : ${localLine}`);
				localLine = `${localLine} --clientid ${process.env.CONSUMERKEY} --jwtkeyfile ${keypath} -r https://test.salesforce.com  --json`;
				logger.debug(`org auth command : ${localLine}`);
				visitor.event('sfdx event', 'org reauth', this.msgJSON.template).send();
			}*/
			if (localLine.includes('sfdx force:org:open') && !localLine.includes(' -r')) {
				localLine = `${localLine} -r --json`;
				logger.debug(`org open command : ${localLine}`);
				visitor.event('sfdx event', 'org open', this.msgJSON.template).send();
			}
			if (localLine.includes(':user:password') && !localLine.includes(' --json')) {
				localLine = `${localLine} --json`;
				logger.debug(`org password command : ${localLine}`);
				visitor.event('sfdx event', 'password gen', this.msgJSON.template).send();
			}
			if (localLine.includes('sfdx force:org:display') && !localLine.includes(' --json')) {
				localLine = `${localLine} --json`;
				logger.debug(`org display command : ${localLine}`);
				visitor.event('sfdx event', 'org display', this.msgJSON.template).send();
			}
			if (localLine.includes('sfdx force:org:create')) {
				// no aliases allowed to keep the deployer from getting confused between deployments
				localLine = argStripper(localLine, '--setalias');
				localLine = argStripper(localLine, '-a');
				localLine = `${argStripper(localLine, '--json')} --json`;
				logger.debug(`org create command : ${localLine}`);
				visitor.event('sfdx event', 'org creation', this.msgJSON.template).send();
			}
			if (localLine.includes('sfdx force:source:push') && !localLine.includes(' --json')) {
				localLine = `${localLine} --json`;
				logger.debug(`source push command : ${localLine}`);
				visitor.event('sfdx event', 'source push', this.msgJSON.template).send();
			}
			if (localLine.includes('sfdx force:user:permset:assign')) {
				localLine = `${localLine} -o ${this.msgJSON.SOusername}`;
				logger.debug(`permset assign command : ${localLine}`);
				visitor.event('sfdx event', 'permset assigned', this.msgJSON.template).send();
			}
			try {
				logger.debug(`running line-- ${localLine}`);
				let lineResult = await exec(localLine);
				if (lineResult.stdout) {
					if(localLine.includes('sfdx force:org:display') && localLine.includes('--verbose')){
						//store result in redis with username as the key.
						//logger.debug(lineResult.stdout); //this log line exposes credentials
						let r=JSON.parse(lineResult.stdout);
						//console.log("writing in redis cache:"+r.result.username,JSON.stringify(r.result)); //this log line exposes credentials
						redis.set(r.result.username,JSON.stringify(r.result));
					}
					logger.debug(lineResult.stdout);
					ch.publish(ex, '', bufferKey(lineResult.stdout, msgJSON.deployId));
				}
				if (lineResult.stderr) {
					logger.error(lineResult.stderr);
					ch.publish(ex, '', bufferKey(`ERROR ${lineResult.stderr}`, msgJSON.deployId));
					visitor.event('deploy error', this.msgJSON.template, lineResult.stderr).send();
				}
			} catch (err) {
				console.error('Error (lines.js): ', err);
				ch.publish(ex, '', bufferKey(`ERROR: ${err}`, msgJSON.deployId));
				visitor.event('deploy error', this.msgJSON.template, err).send();
			}

		}
		logger.debug('Ended the line runs');
		
		if (process.env.DXLOGINURL){
			//remove the key from teh filesystem
			logger.debug(`Remove urlfile: cd tmp;rm ${this.msgJSON.deployId}.txt`);
			exec(`cd tmp;rm ${this.msgJSON.deployId}.txt`);
		}
	};
};


