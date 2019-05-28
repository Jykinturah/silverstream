'use strict';

const Discord = require('discord.js');
const moment = require('moment-timezone');
moment.tz.setDefault("America/Los_Angeles");
const fs = require('fs');
global.Promise = require('bluebird');
const mongoose = require('mongoose');
const validator = require('validator');

var Silverstream = new function() {
	this.client = new Discord.Client();
	this.version = require("./package.json").version;
	this.config = require("./config.json");
	this.replies = require("./replies.json");
	this.botUrl = null;
	this.wordCountDB = null;
	// this.db = null;
	this.enable = false;

	this.commands = {
		"botlink":{
			"synt":"",
			"help":"This is how you get my link to add me to your server! Please ask Jykinturah first!!",
			"admin":false, 
			"exec": function(bot, args, msg){
				console.log(`botlink: ${msg.author.username} (${msg.author.id}) ${msg.channel.type}`);
  				msg.channel.send(`Please ask Jykinturah before you add me to your server!\n<${bot.botUrl}>`).catch(err => {console.log(err)});
			}
		},
		"wordcount":{
			"synt":"[# of words]",
			"help":"This is how you tell me how may words you have written!",
			"admin":false,
			"exec": function(bot, args, msg){
				if(bot.wordCountDB == null) { 
					msg.channel.send("One sec, I'm still a bit disoriented!")
						.catch(err => {console.log(err)}); 
					return; }
				let snowflake = msg.author.id;
				var count = parseInt(args[0], 10);
				if(args.length < 1 || isNaN(count) || count > 1000000 || count < 1) { 
					msg.channel.send("Hey! Don't try to break me, that's mean!!")
						.catch(err => {console.log(err)}); 
					return; 
				}

				bot.wordCountDB.findOne({"discord_id":snowflake}, (err, record) => {
					if (!record) {
						record = new bot.wordCountDB({
							discord_id: snowflake,
							reminder_time: "",
							reminder_enable: false,
							count_total: 0,
							current_year: 0,
							count_day: {},
							count_month: {},
							count_year: {}
						});
					}

					let today = moment();
					let day = today.dayOfYear();
					let month = today.month() + 1;
					let year =  today.year();
					let dayKey = "d_" + day;
					let monthKey = "y_" + year + "_m_" + month;
					let yearKey = "y_" + year;

					// If year is not the same, wipe out date and month counts to save space
					if ( record.current_year != year ) {
						// destroy all daily counts last year
						record.count_day.clear();
						
						// delete all monthly counts before last year
						record.count_month.forEach( (v,k,m) => {
							if( !(k.includes(year) || k.includes(year-1)) ) m.delete(k);
						});

						// update year to current year
						record.current_year = year;
					}

					record.count_total = ( record.count_total ? record.count_total : 0 ) + count;
					record.count_day.set(dayKey, ( record.count_day.has(dayKey) ? record.count_day.get(dayKey) : 0 ) + count);
					record.count_month.set(monthKey, ( record.count_month.has(monthKey) ? record.count_month.get(monthKey) : 0 ) + count);
					record.count_year.set(yearKey, ( record.count_year.has(yearKey) ? record.count_year.get(yearKey) : 0 ) + count);

					record.save();

					msg.channel.send(`Added ${count} words for you, <@${snowflake}>!`)
						.catch(err => {console.log(err)});
				});			
			}
		},
		"getcount":{
			"synt":"",
			"help":"This is how to ask me for your word count totals!",
			"admin":false,
			"exec": function(bot, args, msg){
				if(bot.wordCountDB == null) { 
					msg.channel.send("One sec, I'm still a bit disoriented!")
						.catch(err => {console.log(err)}); 
					return; 
				}
				let snowflake = msg.author.id;

				bot.wordCountDB.findOne({"discord_id":snowflake}, (err, record) => {
					if (!record) {
						msg.author.send(`I have no idea who you are <@${snowflake}>! Sorry! Why don't you try adding some word counts first?`)
							.catch(err => {console.log(err)});
					}

					/** TODO Time period function **/
					let totalCount = record.count_total;
					msg.author.send(`You have a total of ${totalCount} words so far, <@${snowflake}>! Nice!`)
						.catch(err => {console.log(err)});

				});
			}
		},
		"remindnow":{
			"synt":"[+/- hours]",
			"help":`I will remind you to submit your word counts every day +/- the number of hours you say from now! (Ex. ${bot.config.prefix}remindnow +3)`,
			"admin":false,
			"exec": function(bot, args, msg){
				// TODO
				msg.channel.send("This isn't implemented yet, you can bother <@123148298784735232> about it! (remindnow)");
			}
		},
		// "remindme":{
		// 	"synt":"[time] [timezone]",
		// 	"help":"Set a time for me to remind you about your word count! You can put a time like 11:30PM or Wednesday 3PM. I will remind you daily unless you specify a day!",
		// 	"admin":false,
		// 	"exec": function(bot, args, msg){
		// 		// TODO
		// 		msg.channel.send("This isn't implemented yet, you can bother <@123148298784735232> about it! (remindme)");
		// 	}
		// },
		"ping":{
			"synt":"",
			"help":"!!!",
			"admin":true, 
			"exec": function(bot, args, msg){
				msg.channel.send("Peep?")
					.then(m =>{
						m.edit(`Chirrup~! My response time is ${m.createdTimestamp - msg.createdTimestamp}ms!  \`API: ${Math.round(bot.client.ping)}ms\``).catch(err => {console.log(err)});
					})
					.catch(err => {console.log(err)});
			}
		},
		"status":{
			"synt":"",
			"help":"My status!",
			"admin":true, 
			"exec": function(bot, args, msg){
				if(args.length == 1){
					if(args[0] === 'enable') {
						bot.enable = true;
						msg.channel.send("I'm now allowing inputs from users!");
					} else if(args[1] === 'disable'){
						bot.enable = false;
						msg.channel.send("I'm now **not** allowing inputs from users!");
					}
				} else {
					if(bot.enable) msg.channel.send(`I'm allowing inputs from users! Enable: ${bot.enable}`);
					else msg.channel.send(`I'm **not** allowing inputs from users! Enable: ${bot.enable}`);
				}
			}
		},
		"servermng":{
			"synt":"",
			"help":"Manage what servers I am on!",
			"admin":true, 
			"exec": function(bot, args, msg){
				var guilds = bot.client.guilds.array();
				if(args.length == 0){
					let msgtxt = "Servers I am in!\n```";
					guilds.sort(function(a,b){return a.joinedTimestamp - b.joinedTimestamp;});
					for(var i = 0; i < guilds.length; i++){
						msgtxt += i + " [" + guilds[i].id + "] " + guilds[i].name;
						if(i != guilds.length - 1) msgtxt += "\n";
					}
					msgtxt += "```";
					return msg.channel.send(msgtxt);
				}else{
					if(args[0] === 'leave'){
						let index = parseInt(args[1]);
						if(index < guilds.length && index > -1){
							return msg.author.send("Leaving " + guilds[index].name + "!").then(guilds[index].leave()).catch(err => {console.log(err)});
						}
					}
				}
      		}
		},
		"term":{
			"synt":"",
			"help":"NOOOOOO!!!",
			"admin":true, 
			"exec": function(bot, args, msg){
				msg.channel.send("Signing off!")
					.then(m => {
						bot.client.destroy().then(m => { process.exit(0);});
					});
			}
		}
	}
	
	this.run = function(){
		var bot = this; // point bot just for ease
		var cmds = this.commands;
		this.mongoInit(bot); // MONGO STUFF

		bot.client.login(bot.config.clientId);

		bot.client.on("ready", () => {
			console.log("Silverstream v" + this.version + " has started!");
			console.log("Username: " + bot.client.user.tag + " (" + bot.client.user.id + ")");

			bot.client.user.setActivity('you write!', { type: 'WATCHING' }).catch(err=>{throw err;});;

			this.botUrl = "https://discordapp.com/oauth2/authorize?client_id=" + bot.client.user.id + "&scope=bot";

			if (!bot.client.guilds) console.log("I'm not in any servers!"); 
			else 
				if(bot.client.guilds.size > 0) console.log("I am in " + bot.client.guilds.size + " servers!");
				else console.log("I am in 1 server!");
		});

		bot.client.on("message", async (message) => {
			if(message.isMentioned(bot.client.user))
				return message.channel.send(this.reply(message.author)).catch(err => {console.log(err)});
			if(message.author.bot) return;
			if(message.content.indexOf(bot.config.prefix) !== 0) return;

			const args = message.content.slice(bot.config.prefix.length).trim().split(/ +/g);
  			const first = args.shift().toLowerCase();

  			if(first === 'help'){
  				let cmdtxts = Object.keys(cmds).sort((a,b) => {return a > b;});
  				let helptxt = "```\n";
				
				for(var i = 0; i < cmdtxts.length; i++){
					if(!(cmds[cmdtxts[i]].admin) || this.chkAdmin(message.author)){
						helptxt += bot.config.prefix + cmdtxts[i] + " " + cmds[cmdtxts[i]].synt + "\n";
						helptxt += "\t" + cmds[cmdtxts[i]].help + "\n\n"
					}

					if(helptxt.length > 1000){
						helptxt += "```"
						message.author.send(helptxt).catch(console.error);
						helptxt = "```\n";
					}
				}

				if (helptxt.length > 0) {
					helptxt += "```";
					message.author.send(helptxt).catch(console.error);
				}
  				return;
  			}

  			const command = cmds[first];

  			if(command){
  				if(this.chkAdmin(message.author)){
  					return command.exec(bot,args,message);
  				} else if (!command.admin && this.enable){
  					return command.exec(bot,args,message);
  				}
  			}
		});
	}

	/** TODO FUNCTIONS TO MOVE **/

	this.chkAdmin = function(author){
		return this.config.admin.includes(author.id);
	}

	this.reply = function(author){
		return this.replies[Math.floor(Math.random()*this.replies.length)].replace('{usr}',author);
	}

	this.mongoInit = function(bot){
		let mcurl = "mongodb://" + bot.config.mongoUsr + ":" + bot.config.mongoPwd + "@" + bot.config.mongoUrl + "/" + bot.config.mongoDB;
		mongoose.connect(mcurl,{useNewUrlParser: true})
		  .then(() => {
		    console.log('Database connection successful!');
		  })
		  .catch(err => {console.error('Database connection error!');console.error(err);});
		this.wordCountDB = require('./schemas/wordCountSchema.js')(mongoose);
	}
}

Silverstream.run();