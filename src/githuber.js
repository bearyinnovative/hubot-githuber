//Description:
//  Play GitHub with your hubot
//
//Configuration:
//
// HUBOT_GITHUBER_JSON_FILE='xxx.json' (optional)
// HUBOT_GITHUBER_ACCOUNT='your or your organization account name' (required)
//
//Commands:
//
// hubot github token - Set Your GitHub Personal access tokens (please use this commend in hubot p2p for safety reasons)
// hubot github issue new [repo_name] - Add new issue for repo.
// hubot github issue list [repo_name] - List all issues for a repo.
// hubot github issue mine [repo_name] - List all issues assigned to me for a repo.
// hubot github issue all - List all issues assigned to me for a orgs.(if your account is a organization)
// hubot github issue close [repo_name] [#number] - Close a issue/pull request for repo.
// hubot github issue lgtm [repo_name] [#number] - Comment a issue/pull request with LGTM.
// hubot github issue comment [repo_name] [#number] - Comment a issue/pull request with you words.
// hubot github issue pr [repo_name] -  List all pull requests for repo.
// hubot github release new [repo_name] - Create new release for repo.
// hubot github release latest [repo_name] - Show latest release for repo.
// hubot github release check [repo_name] - List new merged pull requests after latest release.
//
//Author:
//  loddit

"use strict";

const fs = require("fs");
const moment = require("moment");
const legilimens = require("legilimens");
const dataFilePath = process.env.HUBOT_GITHUBER_JSON_FILE;

const account =  process.env.HUBOT_GITHUBER_ACCOUNT || '';
const sessions = {};


function getQueryString(obj) {
  return "?" + Object.keys(obj).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`).join('&');
}

module.exports = (robot) => {
  function getToken (res) {
    const tokens = loadData();
    const uid = res.message.user.id;
    return tokens[uid];
  }

  function loadData () {
    if (dataFilePath) {
      return JSON.parse(fs.readFileSync(dataFilePath)) || {};
    } else {
      return JSON.parse(robot.brain.get("hubot-githuber")) || {};
    }
  }

  function saveData (data) {
    if (dataFilePath) {
      fs.writeFileSync(dataFilePath, JSON.stringify(data));
    } else {
      robot.brain.set("hubot-githuber", JSON.stringify(data));
    }
  }

  (function ensureData() {
    try {
      loadData();
    } catch (err) {
      saveData({});
    }
  })();

  function getMyself(token, callback) {
    robot.http(`https://api.github.com/user`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .get()((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          callback(data);
        }
      });
  }

  function createRelease(tag_name, title, body, prerelease, res, token, account, repo) {
    const data = JSON.stringify({
      tag_name,
      title,
      body
    });
    robot.http(`https://api.github.com/repos/${account}/${repo}/releases`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .post(data)((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          const release = data;
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `New Release for ${repo} created: [${release.tag_name}](${release.html_url})`,
            attachments: [{
              title: release.title,
              text: release.body
            }]
          });
        }
      });
  }


  function commentIssue(words, res, token, account, repo, number) {
    const data = JSON.stringify({
      body: words
    });
    robot.http(`https://api.github.com/repos/${account}/${repo}/issues/${number}/comments`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .post(data)((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          const comment = data;
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `New Comment for ${repo} ${number}:`,
            attachments: [{
              text: `${comment.body} \n [${comment.user.login}](${comment.user.html_url}) ${moment(comment.created_at).format('YYYY-MM-DD h:mm:ss a')}`
            }]
          });
        }
      });
  }

  function getIssues(params, res, token, account, repo) {
    const issueAPIUrl = `https://api.github.com/repos/${account}/${repo}/issues`
    const url = params ? issueAPIUrl + getQueryString(params) : issueAPIUrl;
    robot.http(url)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .get()((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `${repo} issues:`,
            attachments: data.map((issue) => {
              return {
                title: `${issue.title}${issue.pull_request ? " (Pull Request)" : ''}`,
                text: `[#${issue.number}](${issue.html_url}) created by [${issue.user.login}](${issue.user.html_url}) ${moment(issue.created_at).format('YYYY-MM-DD h:mm:ss a')}`
              };
            })
          });
        }
      });
  }

  robot.respond(/github token([\s\S]*)/i, (res) => {
    const token = (res.match[1] || '').trim();
    if (token) {
      const tokens = loadData();
      const uid = res.message.user.id;
      tokens[uid] = token;
      saveData(tokens);
      res.reply(`your access token store successfull.`);
    } else {
      res.send("please setup a access token via [settings page](https://github.com/settings/tokens). then use `github token (your token)` to store your token. [docs](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)");
    }
  });

  robot.hear(/([\s\S]+)/i, (res) => {
    const answer = res.match[1].replace(robot.name + " ", '');
    const uid = res.message.user.id;
    if (sessions[uid]) {
      if (answer === "exit" || answer === "quit") {
        sessions[uid] = null;
        res.send("OK, I will ignore you.");
        return;
      };
      const token = getToken(res);
      switch (sessions[uid].step) {
        case "issue-new-title":
          sessions[uid]["title"] = answer;
          sessions[uid]["step"] = "issue-new-body";
          res.send("What is the body of your issue?");
          return;
        case "issue-new-body":
          sessions[uid]["body"] = answer;
          var repo = sessions[uid]["repo"];
          var data = JSON.stringify({
            title: sessions[uid]["title"],
            body: sessions[uid]["body"]
          });
          sessions[uid] = null;
          return robot.http(`https://api.github.com/repos/${account}/${repo}/issues`)
            .header('Content-Type', 'application/json')
            .header('Authorization', `token ${token}`)
            .post(data)((_err, _res, body) => {
              const data = JSON.parse(body)
              if (data.message) {
                res.reply(data.message);
              } else {
                const issue = data;
                robot.emit('bearychat.attachment', {
                  message: res.message,
                  text: `${repo} issue opened:`,
                  attachments: [{
                    title: issue.title,
                    text: `[#${issue.number}](${issue.html_url}) created by [${issue.user.login}](${issue.user.html_url}) ${moment(issue.created_at).format('YYYY-MM-DD h:mm:ss a')} \n ${issue.body}`
                  }]
                });
              }
            });
          return;
        case "issue-comment-body":
          var repo = sessions[uid]["repo"];
          var number = sessions[uid]["number"];
          sessions[uid] = null;
          commentIssue(answer, res, token, account, repo, number);
          return;
        case "release-new-tag":
          sessions[uid]["tag_name"] = answer;
          sessions[uid]["step"] = "release-new-title",
          res.send(`What is the title for this release? answer Y if it is same as tag version.`);
          return;
        case "release-new-title":
          sessions[uid]["title"] = answer === "Y" ? sessions[uid]["tag_name"] : answer;
          sessions[uid]["step"] = "release-new-body";
          res.send(`What is the body for this release? answer Y will use a merged pull requests list after latest release.`);
          return;
        case "release-new-body":
          if (answer ===  "Y") {
            var repo = sessions[uid]["repo"];
            res.send(`Fetching pull requests list. wait a moment....`);
            legilimens(token, `${account}/${repo}`, "master", (output) => {
              sessions[uid]["body"] = output;
              sessions[uid]["step"] = "release-new-prerelease";
              res.send(`OK. last question, is this a prerelease? answer Y or N.`);
            });
          } else {
            sessions[uid]["body"] = answer;
            sessions[uid]["step"] = "release-new-prerelease";
            res.send(`Is this a prerelease? answer Y or N.`);
          }
          return;
        case "release-new-prerelease":
          sessions[uid]["prerelease"] = answer === "Y";
          var {tag_name, title, body, prerelease, repo} = sessions[uid];
          sessions[uid] = null;
          createRelease(tag_name, title, body, prerelease, res, token, account, repo)
          return;
      }
    }
  });

  robot.respond(/github issue list (.+)/i, (res) => {
    const repo = res.match[1];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    getIssues(null, res, token, account, repo);
  });

  robot.respond(/github issue mine (.+)/i, (res) => {
    const repo = res.match[1];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    getMyself(token, (myself) => {
      getIssues({assignee: myself.login}, res, token, account, repo);
    })
  });

  robot.respond(/github issue all/i, (res) => {
    const repo = res.match[1];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    const queryString = getQueryString({filter: "assigned"});
    robot.http(`https://api.github.com/orgs/${account}/issues${queryString}`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .get()((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `all ${account} issues assigned to me:`,
            attachments: data.map((issue) => {
              return {
                title: `${issue.title}${issue.pull_request ? " (Pull Request)" : ''}`,
                text: `[${issue.repository.name}](${issue.repository.html_url}) [#${issue.number}](${issue.html_url}) created by [${issue.user.login}](${issue.user.html_url}) ${moment(issue.created_at).format('YYYY-MM-DD h:mm:ss a')}`
              };
            })
          });
        }
      });
  });

  robot.respond(/github issue new (.+)/i, (res) => {
    const repo = res.match[1];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    res.send("What is the title of your issue?");
    const uid = res.message.user.id;
    sessions[uid] = {
      step: "issue-new-title",
      repo: repo
    }
  });

  robot.respond(/github issue close (.+) (\d+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    robot.http(`https://api.github.com/repos/${account}/${repo}/issues/${number}`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .patch(JSON.stringify({state: "closed"}))((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          const issue = data;
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `${repo} issue closed`,
            attachments: [{
              title: issue.title,
              text: `[#${issue.number}](${issue.html_url}) created by [${issue.user.login}](${issue.user.html_url}) ${moment(issue.created_at).format('YYYY-MM-DD h:mm:ss a')} \n ${issue.body}`
            }]
          });
        }
      });
  });

  robot.respond(/github issue pr (.+)/i, (res) => {
    const repo = res.match[1];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    robot.http(`https://api.github.com/repos/${account}/${repo}/pulls`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .get()((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `${repo} Pull Requests list`,
            attachments: data.map((issue) => {
              return {
                title: issue.title,
                text: `[#${issue.number}](${issue.html_url}) created by [${issue.user.login}](${issue.user.html_url}) ${moment(issue.created_at).format('YYYY-MM-DD h:mm:ss a')}`
              };
            })
          });
        }
      });
  });

  robot.respond(/github issue lgtm (.+) (\d+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    const words = "LGTM";
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    commentIssue(words, res, token, account, repo, number);
  });

  robot.respond(/github issue comment (.+) (\d+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    const uid = res.message.user.id;
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    res.send(`Leave your comment with ${repo} #${number}`);
    sessions[uid] = {
      step: "issue-comment-body",
      repo,
      number
    }
  });

  robot.respond(/github release check (.+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    res.send(`Checking new merged pull requests after latest release of ${repo}, wait a moment......`);
    legilimens(token, `${account}/${repo}`, "master", (output) => {
      res.send(output);
    });
  });

  robot.respond(/github release new (.+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    const uid = res.message.user.id;
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    res.send(`What is the tag version for this release? no idea ? you can follow [semantic versioning](http://semver.org/)`);
    sessions[uid] = {
      step: "release-new-tag",
      repo,
    }
  });

  robot.respond(/github release latest (.+)/i, (res) => {
    const repo = res.match[1];
    const number = res.match[2];
    const token = getToken(res);
    const uid = res.message.user.id;
    if (!token) {
      return res.reply("setup your access token with `github token` cmd first");
    }
    robot.http(`https://api.github.com/repos/${account}/${repo}/releases/latest`)
      .header('Content-Type', 'application/json')
      .header('Authorization', `token ${token}`)
      .get()((_err, _res, body) => {
        const data = JSON.parse(body)
        if (data.message) {
          res.reply(data.message);
        } else {
          const release = data;
          robot.emit('bearychat.attachment', {
            message: res.message,
            text: `Latest Release for ${repo}: [${release.tag_name}](${release.html_url})`,
            attachments: [{
              title: release.title,
              text: release.body
            }]
          });
        }
      });
  });
}

