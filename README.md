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

## NPM Module

https://www.npmjs.com/package/hubot-githuber
