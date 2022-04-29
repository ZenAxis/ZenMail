const config = require("./config.json")
const redisConnection = require("./Util/redisConnection")
const { Client, Collection, MessageEmbed, MessageActionRow, MessageButton, Interaction } = require("discord.js")

const client = new Client({
    intents: [
        "GUILDS",
        "DIRECT_MESSAGES",
        "GUILD_MESSAGES"
    ],
    partials: [
        "MESSAGE",
        "CHANNEL",
        "REACTION"
    ],
    allowedMentions: {
        parse: ["users", "roles"]
    }
})

client.commands = new Collection()

client.on("ready", () => {
    console.log(`${client.user.tag} Has Started.`)
    client.user.setActivity({
        type: "WATCHING",
        name: "DM me to talk to Admins"
    })
    client.redis = redisConnection()
})

client.on("messageCreate", async (message) => {
    if (message.author.bot) return

    const guild = client.guilds.cache.get(config.bot.guild)


    if (message.content.startsWith(config.bot.prefix) && message?.guildId == guild.id) {
        const args = message.content.slice(config.bot.prefix.length).split(/ +/)
        const command = args.shift().toLowerCase()

        if (command == "blacklist") {
            const user = message.mentions.users.first()
            if (!user) return message.channel.send("Please mention a user to blacklist.")
            client.redis.set(`users:${user.id}`, JSON.stringify({
                blacklisted: true
            }))
            return message.channel.send(`${user.tag} has been blacklisted.`)
        }
    }


    if (message.channel.type == "DM") {
        const userData = await client.redis.get(`users:${message.author.id}`)

        if (userData) {
            const tmpJson = JSON.parse(userData)

            if (tmpJson?.blacklisted && !tmpJson?.blacklistReplied) {
                message.reply(`Hey, You've been blacklisted from the bot.`)
                tmpJson.blacklistReplied = true
                await client.redis.set(`users:${message.author.id}`, JSON.stringify(tmpJson))
                return
            }

        }

        if (!userData) {
            const modmailCategory = guild.channels.cache.find(channel => channel.id == config.bot.modmailCategory)

            if (!modmailCategory) {
                throw new Error("Modmail category not found")
            }

            const channel = await modmailCategory.createChannel(`${message.author.username}-${message.author.discriminator}`, {
                type: "TEXT"
            })

            const Data = {
                channel: channel.id,
                user: message.author.id,
                messages: [message]
            }

            await client.redis.set(`users:${message.author.id}`, JSON.stringify(Data))

            const embed = new MessageEmbed()
                .setTitle(`ModMail Ticket Made by ${message.author.tag}!`)
                .setDescription(`${message.content}`)
                .setColor("#00ff00")
                .setTimestamp()

            const compos = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                    .setCustomId("close")
                    .setEmoji("✖️")
                    .setLabel("Close")
                    .setStyle("DANGER")
                )

            const msg = await channel.send({ embeds: [embed], content: `<@&${config.bot.staffId}>`, components: [compos] })

            await msg.pin()

            const embed2 = new MessageEmbed()
                .setTitle(`Mail Sent!`)
                .setDescription(`The Admins have been notified of your message. We will get back to you as soon as possible.`)
                .setColor("BLURPLE")
                .setTimestamp()

            message.author.send({ embeds: [embed2] })
        } else {
            const userJson = JSON.parse(userData)

            if (!userJson?.channel || !userJson?.messages) return

            userJson.messages.push(message)

            await client.redis.set(`users:${message.author.id}`, JSON.stringify(userJson))

            const embed = new MessageEmbed()
                .setTitle(`New Message from ${message.author.username}`)
                .setDescription(`${message.content}`)
                .setColor("#00ff00")
                .setTimestamp()


            const channel = guild.channels.cache.get(userJson.channel)

            if (channel) {
                await channel.send({ embeds: [embed] })
                message.react("✅")
            } else {
                await client.redis.del(`users:${message.author.id}`)
            }
        }
    } else if (message.channel.type == "GUILD_TEXT" && message.member.roles.cache.has(config.bot.staffId)) {

        const users = await client.redis.keys("users:*")

        for (const user of users) {
            const userJson = JSON.parse(await client.redis.get(user))

            if (userJson.channel == message.channel.id) {
                const embed = new MessageEmbed()
                    .setTitle(`Response From Moderator`)
                    .setDescription(`${message.content}`)
                    .setColor("#00ff00")
                    .setTimestamp()

                const user = client.users.cache.get(userJson.user)

                if (user) {
                    try {
                        user.send({ embeds: [embed] })
                    } catch (err) {
                        console.log(`Error sending message to ${user.tag}`)
                        await client.redis.del(user)
                    }
                } else {
                    await client.redis.del(user)
                }
            }
        }

    }
})


client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId == "close") {
        const users = await client.redis.keys("users:*")

        for (const user of users) {
            const userJson = JSON.parse(await client.redis.get(user))

            if (userJson.channel == interaction.channel.id) {

                const embed = new MessageEmbed()
                    .setTitle(`Thread Closed`)
                    .setDescription(`Hey, Thanks For sending in some Mail :). It seems the staff have solved your issue.`)
                    .setColor("DARK_RED")
                    .setTimestamp()
                const user = client.users.cache.get(userJson.user)

                if (user) {
                    try {
                        user.send({ embeds: [embed] })
                    } catch (err) {
                        console.log(`Error sending message to ${user.tag}`)
                    }
                }

                await client.redis.del(user)
                await interaction.channel.delete()
            }
        }

    }
})

client.login(config.bot.token)