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
	
	this.run = function(){
		var bot = this; // point bot just for ease
		this.mongoInit(bot); // MONGO STUFF

		bot.client.login(bot.config.clientId);

		bot.client.on("ready", () => {
			console.log("Silverstream v" + this.version + " has started!");
			console.log("Username: " + bot.client.user.tag + " (" + bot.client.user.id + ")");

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
  			const command = args.shift().toLowerCase();

  			if(this.chkAdmin(message.author) || this.enable){
	  			if(command === 'wordcount'){
	  				return this.wordcount(args,message);
	  			}
	  			if(command === 'register'){
	  				return this.register(args,message);
	    		}
	  			if(command === 'botlink'){
	  				console.log(`botlink: ${message.author.username} (${message.author.id}) ${message.channel.type}`);
	  				return message.channel.send(`Please ask Jykinturah before you add me to your server!\n<${this.botUrl}>`).catch(err => {console.log(err)});
	  			}
	  		}

  			if(this.chkAdmin(message.author)){
  				if(command === 'ping'){
  					const m = await message.channel.send("Peep?").catch(err => {console.log(err)});
  					m.edit(`Chirrup~! My response time is ${m.createdTimestamp - message.createdTimestamp}ms!  \`API: ${Math.round(bot.client.ping)}ms\``).catch(err => {console.log(err)});
  					return;
  				}

  				if(command === 'enstatus'){
  					if(this.enable) message.channel.send(`I'm allowing inputs from users! Enable: ${this.enable}`);
  					else message.channel.send(`I'm not allowing inputs from users! Enable: ${this.enable}`);
  				}
  				
  				if(command === 'enable') this.enable = true;
  				if(command === 'disable') this.enable = false;

  				if(command === 'serverlist' || command === 'guildlist'){
  					// TODO List servers + ids
  				}
  				if(command === 'leaveserver' || command === 'leaveguild'){
  					// TODO Leave server ID or Name
  				}
  			}
		});
	}

	this.wordcount = function(args, msg){
		if(this.db == null) { msg.channel.send("One sec, I'm still a bit disoriented!"); return; }
		if(args.length < 1) { msg.channel.send("Hey! Don't try to break me, that's mean!!"); return; }
		var count = parseInt(args[0], 10)
		if (!args[0] === count) { msg.channel.send("Hey! Don't try to break me, that's mean!!"); return; }
		let snowflake = msg.author.id;
		this.db.collection('users').find({"userid":snowflake}).toArray().then(result => {
			if(result.length < 1) {
				this.db.collection('users').insertOne({"userid":snowflake}).then(r => {
					msg.channel.send(`Hmm... I don't know you before, <@${snowflake}>, but I do now!!`);
					this.db.collection('counts').insertOne({"users_id":ObjectID(r.ops[0]._id),"subdate":new Date(),"count":count})
						.then(r => {
							msg.channel.send(`Added ${count} words for you!`);
							console.log(r);
						}).catch(err => {throw err});
				}).catch(err => {throw err;});
			} else {
				this.db.collection('counts').insertOne({"users_id":ObjectID(result[0]._id),"subdate":new Date(),"count":count})
					.then(r => {
						msg.channel.send(`Added ${count} words for you, <@${snowflake}>!`);
						console.log(r);
					}).catch(err => {throw err});
			}
		}).catch(err => {throw err;});
	}

	this.register = function(args, msg){
		if(this.db == null) { msg.channel.send("One sec, I'm still a bit disoriented!"); return; }
		let snowflake = msg.author.id;
		this.db.collection('users').find({"userid":snowflake}).toArray().then(result => {
			if(result.length < 1) {
				this.db.collection('users').insertOne({"userid":snowflake}).catch(err => {throw err;return false});
				msg.channel.send(`Okay! I'll remember you, <@${snowflake}>!`);
			} else {
				msg.channel.send(`I already know you, <@${snowflake}>!!`);
			}
		}).catch(err => {throw err;});
	}

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