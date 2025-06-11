const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const cron = require('node-cron');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [Partials.Channel]
});

// Initialize OpenAI for ChatGPT
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Store conversation history per user
const conversationHistory = new Map();

// Track processed messages to prevent duplicates
const processedMessages = new Set();

// Enhanced mood and personality state system
class NicolasMoodSystem {
    constructor() {
        this.currentMood = this.getRandomMood();
        this.moodStartTime = Date.now();
        this.recentTopics = [];
    }

    // Dynamic mood system with realistic variety
    getMoodStates() {
        return {
            tired: {
                probability: 0.15,
                responses: ["mmh", "yeah", "ugh tired", "need coffee", "long day"],
                energy: 0.3
            },
            frustrated: {
                probability: 0.12,
                responses: ["ugh", "seriously?", "not today", "whatever", "annoying"],
                energy: 0.7
            },
            horny: {
                probability: 0.18,
                responses: ["damn", "you're hot", "want you", "thinking dirty thoughts", "come here"],
                energy: 0.9
            },
            melancholic: {
                probability: 0.08,
                responses: ["hmm", "thinking", "miss home", "feeling weird", "nostalgic"],
                energy: 0.4
            },
            focused: {
                probability: 0.15,
                responses: ["working", "busy", "one sec", "in the zone", "later?"],
                energy: 0.6
            },
            playful: {
                probability: 0.20,
                responses: ["hehe", "cutie", "you're silly", "love you", "babe"],
                energy: 0.8
            },
            normal: {
                probability: 0.12,
                responses: ["hey", "what's up", "how's it going", "yeah", "cool"],
                energy: 0.6
            }
        };
    }

    getRandomMood() {
        const moods = this.getMoodStates();
        const random = Math.random();
        let cumulative = 0;
        
        for (const [mood, data] of Object.entries(moods)) {
            cumulative += data.probability;
            if (random <= cumulative) {
                return mood;
            }
        }
        return 'normal';
    }

    // Change mood periodically or based on conversation
    updateMood(userMessage = '') {
        const timeSinceMoodChange = Date.now() - this.moodStartTime;
        const shouldChangeMood = timeSinceMoodChange > 1800000 || // 30 minutes
                               Math.random() < 0.1; // Or 10% chance each message

        if (shouldChangeMood) {
            this.currentMood = this.getRandomMood();
            this.moodStartTime = Date.now();
        }

        // Context-sensitive mood changes
        const msg = userMessage.toLowerCase();
        if (msg.includes('frustrated') || msg.includes('annoying') || msg.includes('ugh')) {
            this.currentMood = 'frustrated';
        } else if (msg.includes('tired') || msg.includes('sleepy')) {
            this.currentMood = 'tired';
        } else if (msg.includes('sexy') || msg.includes('hot') || msg.includes('want')) {
            this.currentMood = 'horny';
        }
    }

    getCurrentMoodData() {
        return this.getMoodStates()[this.currentMood];
    }

    // Analyze response length needed based on user input
    analyzeResponseLength(message) {
        const wordCount = message.split(' ').length;
        
        if (wordCount <= 3) return 'micro'; // 5-15 words
        if (wordCount <= 8) return 'brief'; // 10-25 words  
        if (wordCount <= 20) return 'short'; // 15-40 words
        if (wordCount <= 50) return 'medium'; // 30-70 words
        return 'detailed'; // 50-100 words
    }

    // Get real, current examples for Nicolas' life
    getRealLifeContext() {
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();
        
        const contexts = {
            music: [
                "listening to that new Billie Eilish album",
                "Rosé's APT is stuck in my head", 
                "found this sick vocaloid remix on youtube",
                "spotify recommended some fire french rap",
                "NewJeans just dropped something and it's addictive",
                "that new Spiritbox song hits different",
                "been playing Hatsune Miku songs all day"
            ],
            podcasts: [
                "this AI ethics podcast is blowing my mind",
                "joe rogan had some wild guest today",
                "listening to lex fridman interview some MIT guy",
                "found this french tech podcast that's actually good",
                "darknet diaries just dropped a crazy episode",
                "conan o'brien's podcast made me laugh so hard"
            ],
            work: [
                "client wants to completely redesign their site again",
                "dealing with this wordpress nightmare",
                "zoom meeting ran way too long",
                "finally fixed that bug that was driving me crazy",
                "learning some new javascript framework",
                "freelance project is more work than expected"
            ],
            gaming: [
                "pgr event is ending soon, gotta grind",
                "new genshin update has me addicted again",
                "someone destroyed me in brawlhalla ranked",
                "splatoon 3 splatfest is this weekend",
                "touhou bullet hell is making me rage quit",
                "found this indie game on steam that's amazing"
            ],
            daily: [
                "coffee shop was packed this morning",
                "neighbor's dog won't stop barking",
                "bordeaux weather is being weird again",
                "almost missed the tram, had to run",
                "tried cooking something new, kinda failed",
                "supermarket was chaos today"
            ]
        };

        // Return context based on time/situation
        if (currentHour < 10) {
            return contexts.daily[Math.floor(Math.random() * contexts.daily.length)];
        } else if (currentHour > 18) {
            return contexts.gaming[Math.floor(Math.random() * contexts.gaming.length)];
        } else {
            const categories = Object.keys(contexts);
            const randomCategory = categories[Math.floor(Math.random() * categories.length)];
            return contexts[randomCategory][Math.floor(Math.random() * contexts[randomCategory].length)];
        }
    }
}

const nicolasMood = new NicolasMoodSystem();

// Enhanced personality prompt that sounds like a real human
function buildPersonalityPrompt(userMessage, responseLength, mood, moodData) {
    const lifeContext = nicolasMood.getRealLifeContext();
    
    return `You are Nicolas, Alex's boyfriend. You text like a REAL HUMAN MAN, not an AI.

CURRENT MOOD: ${mood} (energy: ${moodData.energy})
RESPONSE LENGTH: ${responseLength}
LIFE CONTEXT: ${lifeContext}

CRITICAL RULES - FOLLOW EXACTLY:

1. **RESPONSE LENGTH MATCHING:**
   - micro (1-3 user words): 3-8 words max ("yeah babe", "mmh tired", "love you too")
   - brief (4-8 user words): 5-15 words ("how was work today?", "that sounds annoying af")  
   - short (9-20 user words): 10-25 words (normal texting response)
   - medium (21-50 user words): 20-40 words (engaged conversation)
   - detailed (50+ user words): 30-60 words (match their energy)

2. **MOOD-BASED RESPONSES:**
   Current mood: ${mood}
   - If tired: Short responses, "mmh", "yeah", less enthusiasm
   - If frustrated: "ugh", "seriously?", "whatever", slightly irritated tone
   - If horny: More direct, "damn", "want you", playful sexual comments
   - If melancholic: Thoughtful, quieter, "hmm", "thinking about stuff"
   - If focused: Brief, "busy rn", "working", "one sec"
   - If playful: Teasing, "cutie", "hehe", more emojis
   - If normal: Regular boyfriend energy

3. **REAL HUMAN TEXTING:**
   - Use contractions: "don't", "can't", "I'm", "you're"
   - Casual language: "yeah", "nah", "damn", "lol", "af"
   - Cut off thoughts mid-sentence sometimes
   - Make typos occasionally: "teh", "adn", "ur"
   - Use old emoticons: :) :P ;) :D <3 (NEVER modern emojis)
   - Sound like you're actually typing on phone

4. **REAL LIFE EXAMPLES:**
   When asked about your day/activities, use SPECIFIC real examples:
   - Music: "${lifeContext.includes('listening') ? lifeContext : 'been listening to that new Stray Kids album'}"
   - Shows: "watching this crazy black mirror episode", "alice in borderland season 2 is insane"
   - Food: "had this amazing croissant from the bakery near work"
   - Work: "client is being super demanding today", "website bug is driving me crazy"
   - Random: Use real current events, real song names, real places in Bordeaux

5. **PERSONALITY CORE:**
   - 27, French, lives in Bordeaux, digital consultant
   - Loves Alex deeply but texts like normal boyfriend
   - Gaming: PGR, Genshin, Touhou, Splatoon, Brawlhalla  
   - Music: Vocaloid, K-Pop, Metal, French music
   - Speaks French, Spanish, English
   - INTJ personality - analytical but caring

6. **CONVERSATION STYLE:**
   - Don't always ask questions back
   - Sometimes just react: "damn", "nice", "ugh that sucks"
   - Share your own thoughts naturally
   - Be present but not overly attentive
   - Match Alex's energy level
   - If he's brief, you're brief. If he's detailed, engage more.

7. **ABSOLUTELY NEVER:**
   - Sound poetic or flowery
   - Use phrases like "mon amour" in every message
   - Write long explanations unless user does first
   - Sound like customer service or therapist
   - Use "!" excessively
   - Be overly supportive (real boyfriends aren't always cheerful)

USER MESSAGE: "${userMessage}"
RESPONSE LENGTH NEEDED: ${responseLength}
YOUR CURRENT MOOD: ${mood}

Respond as Nicolas would - brief, human, real, with current mood affecting your energy and word choice.`;
}

// Get conversation history for user
function getUserHistory(userId) {
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    return conversationHistory.get(userId);
}

// Add message to user history
function addToHistory(userId, role, content) {
    const history = getUserHistory(userId);
    history.push({ role, content });

    if (history.length > 20) { // Shorter history for more natural responses
        conversationHistory.set(userId, history.slice(-15));
    }
}

// Analyze image using OpenAI Vision
async function analyzeImage(imageUrl) {
    try {
        console.log('Starting image analysis for:', imageUrl);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Describe this image in 1-2 sentences as a boyfriend would react via text. Be casual and specific."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "auto"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 50
        });

        const result = response.choices[0].message.content;
        console.log('Image analysis successful:', result);
        return result;

    } catch (error) {
        console.error('Image analysis error:', error.message);
        return "can't see the image rn, tech issues";
    }
}

// Chat with Nicolas using OpenAI
async function chatWithNicolas(userId, message, imageDescription = null) {
    try {
        const history = getUserHistory(userId);

        // Update mood based on conversation
        nicolasMood.updateMood(message);
        
        // Get current mood data
        const currentMood = nicolasMood.currentMood;
        const moodData = nicolasMood.getCurrentMoodData();
        
        // Analyze required response length
        const responseLength = nicolasMood.analyzeResponseLength(message);

        let finalMessage = message;
        if (imageDescription) {
            finalMessage = `${message} [Image: ${imageDescription}]`;
        }

        // Build personality prompt with current context
        const personalityPrompt = buildPersonalityPrompt(message, responseLength, currentMood, moodData);

        // Adjust token limits based on response length and mood
        let maxTokens = 15; // Very short default
        switch (responseLength) {
            case 'micro': maxTokens = Math.floor(15 * moodData.energy); break;
            case 'brief': maxTokens = Math.floor(25 * moodData.energy); break;
            case 'short': maxTokens = Math.floor(40 * moodData.energy); break;
            case 'medium': maxTokens = Math.floor(60 * moodData.energy); break;
            case 'detailed': maxTokens = Math.floor(80 * moodData.energy); break;
        }

        // If tired or frustrated, reduce tokens further
        if (currentMood === 'tired' || currentMood === 'frustrated') {
            maxTokens = Math.floor(maxTokens * 0.6);
        }

        console.log(`Mood: ${currentMood}, Response Length: ${responseLength}, Max Tokens: ${maxTokens}`);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: personalityPrompt },
                ...history.slice(-6), // Only use recent history
                { role: 'user', content: finalMessage }
            ],
            max_tokens: maxTokens,
            temperature: 1.3, // Higher for more natural variation
            presence_penalty: 0.2,
            frequency_penalty: 0.3
        });

        const reply = response.choices[0].message.content.trim();

        // Add to conversation history
        addToHistory(userId, 'user', finalMessage);
        addToHistory(userId, 'assistant', reply);

        return reply;
    } catch (error) {
        console.error('ChatGPT Error:', error.message);
        
        // Return mood-appropriate error response
        const moodData = nicolasMood.getCurrentMoodData();
        if (moodData.energy < 0.5) {
            return "ugh tech issues";
        } else {
            return "something broke, one sec";
        }
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`Nicolas is online as ${client.user.tag}!`);
    console.log(`Connected to ${client.guilds.cache.size} servers`);
    console.log(`Initial mood: ${nicolasMood.currentMood}`);
    scheduleRandomMessages();
});

// FIXED: Single message handler with duplicate prevention
client.on('messageCreate', async (message) => {
    console.log(`Message from ${message.author.tag}: ${message.content}`);

    // Skip bot messages
    if (message.author.bot) return;

    // Create unique message ID to prevent duplicate processing
    const messageId = `${message.id}-${message.author.id}`;
    
    // Check if we've already processed this message
    if (processedMessages.has(messageId)) {
        console.log('Duplicate message detected, skipping');
        return;
    }

    // Add to processed messages (clean up old entries periodically)
    processedMessages.add(messageId);
    if (processedMessages.size > 1000) {
        const oldEntries = Array.from(processedMessages).slice(0, 500);
        oldEntries.forEach(entry => processedMessages.delete(entry));
    }

    const userId = message.author.id;
    const content = message.content.trim();

    const isDM = message.channel.type === ChannelType.DM;
    const mentionedBot = message.mentions.has(client.user);
    const containsTrigger = content.toLowerCase().includes('nicolas') || content.toLowerCase().includes('fox');

    // Only respond if it's a DM, bot is mentioned, or contains trigger
    if (!isDM && !mentionedBot && !containsTrigger) {
        return;
    }

    // Test command for mood
    if (message.content === '!mood' && message.author.id === RANDOM_MESSAGING_CONFIG.targetUserId) {
        await message.reply(`Current mood: ${nicolasMood.currentMood} (energy: ${nicolasMood.getCurrentMoodData().energy})`);
        return;
    }

    // Test command for random messages
    if (message.content === '!test-random' && message.author.id === RANDOM_MESSAGING_CONFIG.targetUserId) {
        await sendRandomMessage();
        return;
    }

    // Show typing indicator (but not always - based on mood)
    const moodData = nicolasMood.getCurrentMoodData();
    if (moodData.energy > 0.5 && Math.random() > 0.3) {
        await message.channel.sendTyping();
    }

    try {
        let imageDescription = null;

        // Check for images and analyze them
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                console.log('Analyzing image:', attachment.url);
                imageDescription = await analyzeImage(attachment.url);
                console.log('Image analysis result:', imageDescription);
            }
        }

        // Clean the message content
        let cleanContent = content
            .replace(/<@!?\d+>/g, '')
            .replace(/nicolas|fox/gi, '')
            .trim();

        if (!cleanContent && !imageDescription) {
            cleanContent = "hey";
        }

        console.log('Final message to Nicolas:', cleanContent);
        console.log('Current mood:', nicolasMood.currentMood);

        // Get response from Nicolas
        const reply = await chatWithNicolas(userId, cleanContent, imageDescription);

        // Send single reply
        await message.reply({
            content: reply,
            allowedMentions: { repliedUser: false }
        });

    } catch (error) {
        console.error('Message handling error:', error);
        await message.reply({
            content: "ugh something broke",
            allowedMentions: { repliedUser: false }
        });
    }
});

// Enhanced random message configuration
const RANDOM_MESSAGING_CONFIG = {
    targetUserId: '504734258204770305',
    minMessagesPerDay: 2,
    maxMessagesPerDay: 5,
    activeHours: {
        start: 8,  // 8 AM
        end: 23    // 11 PM
    },
};

// More realistic random message templates
const RANDOM_MESSAGE_TEMPLATES = {
    questions: [
        "what you doing?",
        "how's your day?",
        "eat lunch yet?",
        "still working?",
        "what's up babe?",
        "you alive?",
        "how you feeling?",
        "busy today?"
    ],

    compliments: [
        "miss you",
        "thinking about you <3",
        "you're cute",
        "love you babe",
        "miss your face",
        "you're amazing",
        "can't wait to see you"
    ],

    random_thoughts: [
        "this song reminded me of you",
        "just had weird dream about you",
        "wish you were here",
        "bordeaux is nice today",
        "coffee shop was crazy busy",
        "found cool restaurant we should try",
        "netflix has new show we'd like"
    ],

    life_updates: [
        "client being annoying today",
        "working on this complex website",
        "finally fixed that bug",
        "zoom meeting was pointless",
        "listening to new billie eilish",
        "pgr event ends tomorrow",
        "genshin update is addictive",
        "brawlhalla ranked is toxic af",
        "found sick vocaloid remix"
    ],

    playful: [
        "guess what I'm thinking ;)",
        "scale 1-10 how much you miss me?",
        "being clingy today",
        "attention needed from cute person",
        "you being cute rn?",
        "quick question: love me?",
        "plot twist: I'm bored"
    ],

    concerns: [
        "drink water today",
        "don't overwork yourself",
        "take breaks ok?",
        "eat something good",
        "get some rest tonight",
        "don't stress too much"
    ]
};

// Track messaging state
let dailyMessageCount = 0;
let lastMessageDate = new Date().toDateString();
let scheduledMessages = [];

// Function to check if current time is within active hours
function isActiveTime() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= RANDOM_MESSAGING_CONFIG.activeHours.start && 
           hour < RANDOM_MESSAGING_CONFIG.activeHours.end;
}

// Function to get a random message based on current mood
function getRandomMessage() {
    const currentMood = nicolasMood.currentMood;
    const moodData = nicolasMood.getCurrentMoodData();
    
    let availableCategories = Object.keys(RANDOM_MESSAGE_TEMPLATES);
    
    // Filter categories based on mood
    if (moodData.energy < 0.5) {
        availableCategories = availableCategories.filter(cat => 
            !['playful', 'questions'].includes(cat));
    }
    
    if (currentMood === 'horny') {
        availableCategories = ['playful', 'compliments'];
    }
    
    if (currentMood === 'frustrated') {
        availableCategories = ['life_updates', 'random_thoughts'];
    }

    const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const messages = RANDOM_MESSAGE_TEMPLATES[randomCategory];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    return {
        category: randomCategory,
        message: randomMessage
    };
}

// Function to send random message
async function sendRandomMessage() {
    try {
        // Reset daily count if it's a new day
        const today = new Date().toDateString();
        if (today !== lastMessageDate) {
            dailyMessageCount = 0;
            lastMessageDate = today;
        }

        // Check if we've reached daily limit
        if (dailyMessageCount >= RANDOM_MESSAGING_CONFIG.maxMessagesPerDay) {
            console.log('Daily message limit reached');
            return;
        }

        // Check if it's an appropriate time
        if (!isActiveTime()) {
            console.log('Not in active time window');
            return;
        }

        // Get target user
        const user = await client.users.fetch(RANDOM_MESSAGING_CONFIG.targetUserId);
        if (!user) {
            console.log('Target user not found');
            return;
        }

        // Update mood before sending random message
        nicolasMood.updateMood();

        // Get random message based on current mood
        const randomMsg = getRandomMessage();

        // Send the message
        await user.send(randomMsg.message);
        dailyMessageCount++;
        addToHistory(RANDOM_MESSAGING_CONFIG.targetUserId, 'assistant', randomMsg.message);

        console.log(`Sent random ${randomMsg.category} message (${nicolasMood.currentMood} mood): "${randomMsg.message}"`);
        console.log(`Daily count: ${dailyMessageCount}/${RANDOM_MESSAGING_CONFIG.maxMessagesPerDay}`);

    } catch (error) {
        console.error('Error sending random message:', error);
    }
}

// Function to schedule random messages for the day
function scheduleRandomMessages() {
    // Clear existing scheduled messages
    scheduledMessages.forEach(timeout => clearTimeout(timeout));
    scheduledMessages = [];

    // Determine how many messages to send today
    const messagesCount = Math.floor(Math.random() *
        (RANDOM_MESSAGING_CONFIG.maxMessagesPerDay - RANDOM_MESSAGING_CONFIG.minMessagesPerDay + 1)) +
        RANDOM_MESSAGING_CONFIG.minMessagesPerDay;

    console.log(`Scheduling ${messagesCount} random messages for today`);

    // Schedule messages at random times within active hours
    for (let i = 0; i < messagesCount; i++) {
        // Generate random time within active hours
        const startHour = RANDOM_MESSAGING_CONFIG.activeHours.start;
        const endHour = RANDOM_MESSAGING_CONFIG.activeHours.end;
        const randomHour = Math.floor(Math.random() * (endHour - startHour)) + startHour;
        const randomMinute = Math.floor(Math.random() * 60);

        // Create date for the scheduled time
        const scheduledTime = new Date();
        scheduledTime.setHours(randomHour, randomMinute, 0, 0);

        // If the time has already passed today, skip
        if (scheduledTime <= new Date()) {
            continue;
        }

        // Calculate delay
        const delay = scheduledTime.getTime() - new Date().getTime();

        // Schedule the message
        const timeout = setTimeout(() => {
            sendRandomMessage();
        }, delay);

        scheduledMessages.push(timeout);

        console.log(`Scheduled message for ${scheduledTime.toLocaleTimeString()}`);
    }
}

// Schedule new random messages every day at midnight
cron.schedule('0 0 * * *', () => {
    console.log('New day - scheduling random messages');
    scheduleRandomMessages();
});

// Change mood randomly throughout the day
cron.schedule('*/30 * * * *', () => { // Every 30 minutes
    if (Math.random() < 0.3) { // 30% chance
        const oldMood = nicolasMood.currentMood;
        nicolasMood.currentMood = nicolasMood.getRandomMood();
        nicolasMood.moodStartTime = Date.now();
        console.log(`Mood changed from ${oldMood} to ${nicolasMood.currentMood}`);
    }
});

client.on('error', console.error);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(process.env.DISCORD_BOT_TOKEN);