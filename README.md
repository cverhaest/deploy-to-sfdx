# SFDX "Workshop Automator"

Issue with sfdx-cli update - 20220928

Issue with Redis TSL/SSL - 20220905

Issue with "CLOUDAMQP_APIKEY" value - The value had to be recovered from the URL of the "CloudAMQP" add-on - 20220902
sfdxappwizard
old value: 0364ebea-6cdc-4a39-aeb4-0e5c2e9114a8
new value: ee372103-926b-4d28-9213-38e31e705b69
sfdxappwizard-en
old value: a504c760-617e-4ae6-83b4-7f7a21159f75
new value: cc0fbdc1-2cd0-4861-ab8f-f7ebfee65680

Upgrading to the Latest Heroku Stack - 20220902

Apps running on the Heroku-16 stack, which reaches end-of-life on May 1st, 2021. - 20210309

On March 10, 2021, we announced the Heroku Redis Hobby Tier Version Deprecation - 20210426

## Issue while updating Salesforce sfdx-cli.
Removed automatic sfdx update from .procfile

Command lines to run manually: 
heroku run bash --app sfdxappwizard or heroku run bash --app sfdxappwizard-en
sfdx update

## Update Heroku app
git remote rm origin
git remote add origin https://github.com/cverhaest/deploy-to-sfdx.git
git add .
git status
git commit -m "Workshop Automator sfdx-cli update crash commit"
git push -u origin master
heroku git:remote -a sfdxappwizard
git push heroku master
heroku git:remote -a sfdxappwizard-en
git push heroku master

## Deleting a specific scratch org using sfdx-cli
sfdx auth:web:login -d -a myscratchorg --instanceurl https://test.salesforce.com
sfdx force:org:delete -u #scratchorg_username#

## Purpose

You have a dev hub, and an sfdx repo.  You'd like to let people spin up scratch orgs based on the repo, and have step by step approach to define the metadata, based on github  branches. In addition, you audience doesn't have any access to a devhub or the CLI:
* because they might not be developers (think admins, or even end users in a training scenario)
* because they might not be Salesforce developers (say you built an app and give your designer/CSS person github access to "make it cool")
* because you might have dev hub access and you don't want to give it to them
* because you want to let people test the app quickly
* because (like me) you're using it for workshops and demos
---

## Environment variables

### Required
* `GIT_REPOURL` The URL to access the root of the GitHub repo

### Cloud only
* `DXLOGINURL` The login URL to authenticate against the dev hub. Get it by running `sfdx force:org:display --verbose` from the Salesforce CLI
* `CLOUDAMQP_URL` starts with amqp://, generated by installing the amqp add-on
* `REDIS_URL` generated by installing the heroku redis add-on

### optional
* `UA_ID` for google analytics measurement protocol
* `GITHUB_USERNAME_WHITELIST` lets you whitelist usernames.  It's a comma-separated list.  Ex: `mshanemc,andrew,bebraw`
* `GITHUB_REPO_WHITELIST` lets you whitelist username/repo combinations.  It's a comma-separated list. Ex: `mshanemc/DF17integrationWorkshops,torvalds/linux`

What's whitelisting do?  Normally, this app will parse your orgInit.sh and throw an error if you're doing any funny business.  BUT if you're on the whitelist, the app owner trusts you and you can do things with bash metacharacters (think &&, |, >) and execute non-sfdx commands  (grep, rm, whatever!) etc.  BE CAREFUL!

Here's a heroku button so you can have your own instance of the Deployer

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https%3A%2F%2Fgithub.com%2Fcverhaest%2Fdeploy-to-sfdx)

---
## Heroku setup

The button will start this on free hobby dynos.  For real life, I'd recommend a pair of web 1x and a pair of workers at 1x.

If you're going to be doing a lot of users (imagine a workshop where lots of people are pushing the button at the same time) you can scale out more workers so the people last in line don't have to wait so long.  Otherwise, it'll spin while the workers are busy processing the deploy request queue.

---

## Architectural overview

Nodejs, express for the web server.
When the web server receives a request, it creates a unique deployID (user-repo-timestamp) and a message on the deploy queue (using rabbitMQ)
The server redirects the user to a web page which subscribes to a websocket

When a worker starts up, it auths to a devhub via its environment variables.
Then it listens to the deploy queue and executes jobs
* clone the repo into local filestorage
* Authenticate to the scratch org using credentials cached in redis
* execute the orgInit.sh script, or the default create/push/open flow if there isn't one
* drop the output results of these steps into a broadcast exchange
* delete the local folder and send the ALLDONE message

All the web servers are subscribed to the broadcast exchange.  When they receive messages, they look at the deployID and send the messages down to the matching client.

## Local Setup (Mac...others, who knows?)

You'll need to have a local filesystem structure that kinda replicates what we're doing on the heroku dyno.
```
mkdir tmp
```

You'll also need rabbitmq running locally (handled on heroku via cloudamqp)

https://www.rabbitmq.com/install-homebrew.html  

which you'll start up with
`/usr/local/sbin/rabbitmq-server` (accept any popups to allow comms)

or use a docker container...

then start this app with
`heroku local`

---
## Debugging on [non-local] Heroku
if **hosted-scratch-qa** is the name of your app

`heroku logs --tail -a hosted-scratch-qa` will give you the logs.  This app uses console.log pretty heavily.

`heroku ps:exec -a hosted-scratch-qa --dyno=worker.1` lets you ssh into the dyno of your choice and take a look around, clean stuff up, etc.

---
## Setting up a repo

So you need a target repo to deploy (see examples below).  

You will need to have a steps.json file in the master branch.
This is a simple json array of object with the title, body and button label for each steps

```json
[{
    "title":"Title of the step 1",
    "body":"Explanation of what to do in this step 1",
    "button":"Title of the button that launch the deploy 1"
},
{
    "title":"Title of the step 2",
    "body":"Explanation of what to do in this step 2",
    "button":"Title of the button that launch the deploy 2"
}]
``` 

Then, you will need to create a separate branch for each step named "stepn" (ie: step0,step1,step2,etc);

In each branch, you will need to have:
* an orgInit.sh file listing all the sfdx commands that will be executed by the deployer. Remember, no bash metacharacters and only sfdx commands are allowed (We can't let anyone run any arbitrary command on our servers...security, yo!) That lets you create records, assign permsets, create users, install packages, run tests, generate passwords, and do anything you can do with an SFDX command
* the sfdx source that will be pushed 

---
## Example Repos with all necessary files and branches

https://github.com/cverhaest/sfdx-travelApprovalAPP-EN.git

