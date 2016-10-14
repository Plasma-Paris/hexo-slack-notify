'use strict';

var low = require('lowdb'), path = require('path');
var fs = require('hexo-fs');

const dbNotif = low(path.join(hexo.base_dir, 'db-notif.json'));

var postsToNotify = [];
var allimagesUrls = [];

dbNotif.defaults({ notifs: [] }).value()

console.log('[Hexo Slack]: register server_middleware');
console.error('[Hexo Slack]: hexo', hexo.env.version);

var Slack = require('slack-node');

if(!hexo.config.slack){
    console.error('[Hexo Slack]: hexo.config.slack invalid', hexo.config.slack);
    return;
}else{
    if(!hexo.config.slack.webhookUri){
        console.error('[Hexo Slack]: hexo.config.slack.webhookUri invalid', hexo.config.slack);
    }
}

var webhookUri = hexo.config.slack.webhookUri;
var isSlackEnabled = hexo.config.slack.isSlackEnabled;
console.log('[Hexo Slack]: SlackEnabled', isSlackEnabled);

hexo.route.on('update', function(path) {
    if(path.endsWith('.png')){
        // console.error('[Hexo Slack]: update', path);
        allimagesUrls.push(path);
    }
});

hexo.extend.filter.register('after_generate', function() {

    // console.error('[Hexo Slack]: register after_generate', dbNotif.get('notifs').value().length);
    // console.error('[Hexo Slack]: register after_generate > postsToNotify', postsToNotify.length);

    if(!hexo.config.slack.webhookUri){
        return;
    }

    var slack = new Slack();
    slack.setWebhook(webhookUri);

    if(isSlackEnabled){
        postsToNotify.forEach(function(element) {
            // console.error('[Hexo Slack]: Notify for', element.permalink);
            
            var slackData = {
                username: hexo.config.slack.username || hexo.config.url,
                attachments: [
                    {
                        pretext: (hexo.config.slack.pretext || "New post on") + " <"+hexo.config.url+">",
                        title: element.title,
                        title_link: encodeURI(element.permalink),
                        fields: [],
                        // image_url: "https://datadoghq.com/snapshot/path/to/snapshot.png",
                        color : "#764FA5"
                    }
                ]
                // text: element.raw,
                // mrkdwn: true,
            }

            // console.error('[Hexo Slack]: Exists', path.join(element.asset_dir, 'poster.png'));
            // console.error('[Hexo Slack]: Exists', path.join(element.asset_dir, 'illustration.jpg'));

            //INFO : Gestion de l'iilustration.
            var posterSearch = hexo.config.slack.posterSearch || 'illustration.jpg|poster.png';
            var posterSearchList = posterSearch ? posterSearch.split("|") : [];
            posterSearchList.every(function(searchValue) {
                searchValue = searchValue.trim();

                if (searchValue && fs.existsSync(path.join(element.asset_dir, searchValue))) {
                    slackData.attachments[0].image_url = encodeURI(element.permalink + searchValue);
                    return false;
                }
                return true;
            });

            //INFO : Gestion de la catégorie
            if(element.categories && element.categories.data && element.categories.length > 0){
                slackData.attachments[0].fields.push(
                    {
                        title: (hexo.config.slack.fieldTitle || "Categorie"),
                        value: element.categories.data[0].name,
                        short: true
                    }
                );
            }

            // console.log('[Hexo Slack]: after_post_render slackData', slackData);

            slack.webhook(slackData, function(err, response) {
                if(response && response.statusCode != 200) console.error('[Hexo Slack]: slack.webhook err', response);
                if(err) console.error('[Hexo Slack]: slack.webhook err', err);
            });

            // // console.error('[Hexo Slack]: after_post_render data', element);
            // console.error('[Hexo Slack]: after_post_render slug', element.slug);
            // console.error('[Hexo Slack]: after_post_render title', element.title);
            // console.error('[Hexo Slack]: after_post_render source', element.source);
            // // console.error('[Hexo Slack]: after_post_render raw', element.raw);
            // // console.error('[Hexo Slack]: after_post_render content', element.content);
            // // console.error('[Hexo Slack]: after_post_render more', element.more);
            // console.error('[Hexo Slack]: after_post_render _id', element._id);
            // console.error('[Hexo Slack]: after_post_render date', element.date);
            // console.error('[Hexo Slack]: after_post_render path', element.path);
            // console.error('[Hexo Slack]: after_post_render permalink', element.permalink);
            // console.error('[Hexo Slack]: after_post_render updated', element.updated.Number);
            // console.error('[Hexo Slack]: after_post_render published', element.published);

            // console.error('[Hexo Slack]: after_post_render asset_dir', element.asset_dir);
            // // console.error('[Hexo Slack]: after_post_render tags', element.tags);
            
            // if(element.categories && element.categories.data && element.categories.length > 0)
            //     console.error('[Hexo Slack]: after_post_render categories:', element.categories.data[0].name);

        });
    }

    allimagesUrls = [];
    postsToNotify = [];

});

hexo.extend.filter.register('after_post_render', function(data){

    var lNotif = dbNotif.get('notifs').find({ slug: data.slug }).value()
    // console.log('[Hexo Slack]: after_post_render find by slug', data.slug, !lNotif);

    if(!lNotif){
        dbNotif.get('notifs').push({ id: data._id, slug: data.slug, date: data.date, updated: data.updated}).value()
        postsToNotify.push(data);
    }
});
