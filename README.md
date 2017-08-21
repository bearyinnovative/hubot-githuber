# hubot-githuber

do some github stuff by hubot

See [`src/githuber.js`](src/githuber.js) for full documentation.

## Installation

In hubot project repo, run:

`npm install hubot-githuber --save`

Then add **hubot-githuber** to your `external-scripts.json`:

```json
[
  "hubot-githuber"
]
```


## Environments

1. set `HUBOT_GITHUBER_JSON_FILE="a json file path that store all access token"` (optional, otherwise hubot will use his brain)
2. set `HUBOT_GITHUBER_ACCOUNT="account name for all repo"` (required, both user and organization are acceptable)

## Usage

Setup your Access Token， you can get one via [Setting Page](https://github.com/settings/tokens).

```
user>> hubot github token XXXXXXXXXXXXXXXXXXXXXXXXXXX
hubot>> your access token store successfull.
```

Do Some Action

```
user>> hubot github issue new repo
hubot>> What is the title of your issue?
user>> Update README
hubot>> What is the body of your issue?
user>> should update the usage part.
hubot>> new issue opened:
        #412 Update README
        should update the usage part.

user>> hubot github issue mine repo
hubot>> repo issue list:
        1. #412 Update README
        2. #411 Fix typos

user>> hubot release latest repo
hubot>> Checking new merged pull requests after latest release, wait a moment......

```

Quit a Session

```
user>> hubot github issue new repo
hubot>> What is the title of your issue?
user>> exit
hubot>> OK, I will ignore you.
```

More Actions

```
user>> hubot github help
hubot>> ...
```

## NPM Module

https://www.npmjs.com/package/hubot-githuber
