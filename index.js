require("dotenv").config();


const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Discord Translator Bot is running!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server started");
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
// const { translate } = require("@vitalets/google-translate-api");
const TRANSLATE_CHANNELS = ["translate"];
const cache = new Map();
const cooldowns = new Map();
// let targetLanguage = "en";
let userLanguages = {};

if (fs.existsSync("languages.json")) {
  userLanguages = JSON.parse(
    fs.readFileSync("languages.json", "utf8")
  );
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (!TRANSLATE_CHANNELS.includes(message.channel.name)) {
    return;
  }

  // Change language command
  if (message.content.startsWith("!lang ")) {
    const choice = message.content.split(" ")[1].toLowerCase();

    const languages = {
  english: "English",
  japanese: "Japanese",
  korean: "Korean",
  german: "German",
  spanish: "Spanish"
};

    if (!languages[choice]) {
      return message.reply(
        "❌ Available languages: english, japanese, korean, german, spanish"
      );
    }

    userLanguages[message.author.id] = languages[choice];

    fs.writeFileSync(
      "languages.json",
      JSON.stringify(userLanguages, null, 2)
    );

    return message.reply(
      `✅ Your language is now ${choice}`
    );
  }

  // Show current language
  if (message.content === "!mylang") {
    const lang =
      userLanguages[message.author.id] || "en";

    return message.reply(
      `🌐 Your current language is ${lang}`
    );
  }

  if (message.content.startsWith("!ask ")) {
  const prompt = message.content.slice(5);

  try {
    const result =
      await model.generateContent(prompt);

    return message.reply(
      result.response.text()
    );
  } catch (err) {
    console.error(err);

    return message.reply(
      "❌ Gemini error."
    );
  }

}

  try {
    const targetLanguage =
      userLanguages[message.author.id] || "English";

    // Cooldown starts here
    const now = Date.now();

    if (cooldowns.has(message.author.id)) {
      const expires = cooldowns.get(message.author.id);

      if (now < expires) {
        return message.reply(
          "⏳ Please wait 5 seconds before translating again."
        );
      }
    }

    cooldowns.set(
      message.author.id,
      now + 5000
    );

    // Cache
    const cacheKey =
      `${message.content}-${targetLanguage}`;

    if (cache.has(cacheKey)) {
      return message.reply(
        `🌐 Translation:\n${cache.get(cacheKey)}`
      );
    }

    // const result = await translate(
    //   message.content,
    //   {
    //     to: targetLanguage,
    //   }
    // );

    // if (
    //   result.text.toLowerCase() ===
    //   message.content.toLowerCase()
    // ) {
    //   return;
    // }

    // cache.set(cacheKey, result.text);

    // await message.reply(
    //   `🌐 Translation:\n${result.text}`
    // );

    const prompt = `
Translate the following text to ${targetLanguage}.

Only return the translated text.
Do not explain anything.

Text:
${message.content}
`;

const result = await model.generateContent(prompt);

const translated =
  result.response.text().trim();

if (
  translated.toLowerCase() ===
  message.content.toLowerCase()
) {
  return;
}

cache.set(cacheKey, translated);

await message.reply(
  `🌐 Translation:\n${translated}`
);

  } catch (err) {
    console.error(err);
  }
});
client.login(process.env.TOKEN);
