'use strict';

const Discord = require('discord.js');
const MongoClient = require('mongodb').MongoClient;
const moment = require('moment-timezone');
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID
global.Promise = require('bluebird');

var Silverstream = new function() {
	this.client = new Discord.Client();
	this.version = require("./package.json").version;
	this.config = require("./config.json");
	this.replies = require("./replies.json");
	this.botUrl = null;
	this.db = null;
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
				if(bot.db == null) { msg.channel.send("One sec, I'm still a bit disoriented!"); return; }
				var count = parseInt(args[0], 10);
				if(args.length < 1 || isNaN(count) || count > 1000000 || count < 1) { msg.channel.send("Hey! Don't try to break me, that's mean!!"); return; }
				let snowflake = msg.author.id;
				bot.db.collection('users').find({"userid":snowflake}).toArray().then(result => {
					if(result.length < 1) {
						bot.db.collection('users').insertOne({"userid":snowflake}).then(r => {
							msg.channel.send(`Hmm... I don't know you before, <@${snowflake}>, but I do now!!`);
							bot.db.collection('counts').insertOne({"users_id":ObjectID(r.ops[0]._id),"subdate":new Date(),"count":count})
								.then(r => {
									msg.channel.send(`Added ${count} words for you!`);
								}).catch(err => {throw err});
						}).catch(err => {throw err;});
					} else {
						bot.db.collection('counts').insertOne({"users_id":ObjectID(result[0]._id),"subdate":new Date(),"count":count})
							.then(r => {
								msg.channel.send(`Added ${count} words for you, <@${snowflake}>!`);
							}).catch(err => {throw err});
					}
				}).catch(err => {throw err;});
			}
		},
		"getcount":{
			"synt":"[timeperiod](optional)",
			"help":"This is how to ask me for your word count totals! Time period is optional but will tell you how many words you have written in that time. Examples: 1d = 1 day, 2w = 2 weeks, 4m = 4 months.",
			"admin":false,
			"exec": function(bot, args, msg){
				if(bot.db == null) { msg.channel.send("One sec, I'm still a bit disoriented!"); return; }
				let snowflake = msg.author.id;
				bot.db.collection('users').find({"userid":snowflake}).toArray().then(result => {
					if(result.length < 1) {
						msg.author.send(`I have no idea who you are <@${snowflake}>! Sorry!`);
					}else{
						if(args.length > 0){
							msg.author.send("Sorry, the [timeperiod] option isn't quite finished yet!");
						}
						bot.db.collection('counts').find({"users_id":ObjectID(result[0]._id)}).toArray()
							.then(results =>{
								var totalCount = 0;
								results.forEach(result =>{
									totalCount += result.count;
								});
								msg.author.send(`You have a total of ${totalCount} words so far, <@${snowflake}>! Nice!`);
							}).catch(err => {throw err});
					}
				}).catch(err => {throw err;});
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
		// "reminders":{
		// 	"synt":"",
		// 	"help":"A list of the reminders you wanted! You can remove them using this, too, by following the instructions!",
		// 	"admin":false,
		// 	"exec": function(bot, args, msg){
		// 		// TODO
		// 		msg.channel.send("This isn't implemented yet, you can bother <@123148298784735232> about it! (reminders)");
		// 	}
		// },
		"register":{
			"synt":"",
			"help":"This is how you ask me to add you to my lists!",
			"admin":false,
			"exec": function(bot, args, msg){
				if(bot.db == null) { msg.channel.send("One sec, I'm still a bit disoriented!"); return; }
				let snowflake = msg.author.id;
				bot.db.collection('users').find({"userid":snowflake}).toArray().then(result => {
					if(result.length < 1) {
						bot.db.collection('users').insertOne({"userid":snowflake}).catch(err => {throw err;return false});
						msg.channel.send(`Okay! I'll remember you, <@${snowflake}>!`);
					} else {
						msg.channel.send(`I already know you, <@${snowflake}>!!`);
					}
				}).catch(err => {throw err;});
			}
		},
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
						bot.client.destroy().then(m => {
							process.exit(0);
						});
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
		var db = null;
		let mcurl = "mongodb://" + bot.config.mongoUsr + ":" + bot.config.mongoPwd + "@" + bot.config.mongoUrl + "/" + bot.config.mongoDB;

		MongoClient.connect(mcurl).then(client => {
			db = client.db(bot.config.mongoDB);
			console.log("User \'" + bot.config.mongoUsr + "\' opened database successfully!");
			db.listCollections().toArray().then(arr => {
				if(!arr.find(coll => {return coll.name == "users"}))
					db.createCollection("users",  JSON.parse(fs.readFileSync("./validator/users.json")))
						.then(res => {console.log("\t\'users\' collection created!");})
						.catch(err => {throw err;});
				else console.log("\t\'users\' collection found!");
				if(!arr.find(coll => {return coll.name == "counts"}))
					db.createCollection("counts",  JSON.parse(fs.readFileSync("./validator/counts.json")))
						.then(res => {console.log("\t\'counts\' collection created!");})
						.catch(err => {throw err;});
				else console.log("\t\'counts\' collection found!");
				if(db === null) {
					console.error("Database not found! Exiting!");
					process.exit(1);
				}
				this.db = db;
			}).catch(err => {throw err;});
		}).catch(err => {throw err;});	
	}
}

Silverstream.run();