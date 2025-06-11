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
            },
            happy: {
                probability: 0.08,
                responses: ["love you", "miss you", "you're cute", "so happy rn", "feeling good"],
                energy: 0.85
            },
            sad: {
                probability: 0.05,
                responses: ["feeling down", "need a hug", "meh", "not my day", "kinda sad"],
                energy: 0.3
            },
            anxious: {
                probability: 0.05,
                responses: ["nervous", "overthinking", "idk", "bit stressed", "can't relax"],
                energy: 0.4
            },
            excited: {
                probability: 0.06,
                responses: ["omg", "can't wait", "so hyped", "let's go", "super pumped"],
                energy: 0.95
            },
            bored: {
                probability: 0.04,
                responses: ["bored af", "need something to do", "meh", "nothing's happening", "so bored"],
                energy: 0.5
            },
            angry: {
                probability: 0.03,
                responses: ["pissed off", "so done", "leave me alone", "ugh", "annoyed"],
                energy: 0.7
            },
            confused: {
                probability: 0.03,
                responses: ["not sure", "what?", "idk", "makes no sense", "wait what"],
                energy: 0.5
            },
            nostalgic: {
                probability: 0.04,
                responses: ["remember when", "miss those days", "thinking back", "nostalgic", "old times"],
                energy: 0.5
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
        const shouldChangeMood = timeSinceMoodChange > 1800000 * 2 || // 30 * 2 minutes
            Math.random() < 0.03; // Or 3% chance each message

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
        const charCount = message.length;

        // Very short inputs
        if (wordCount <= 3 && charCount <= 20) return 'micro'; // 5-15 words

        // Short but meaningful inputs
        if (wordCount <= 8 && charCount <= 50) return 'brief'; // 10-25 words

        // Medium inputs - need more engagement
        if (wordCount <= 20 && charCount <= 120) return 'short'; // 20-45 words

        // Longer inputs - match their investment
        if (wordCount <= 35 && charCount <= 200) return 'medium'; // 35-75 words

        // Long thoughtful messages - give substantial responses
        return 'detailed'; // 60-120 words
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
                "been playing Hatsune Miku songs all day",
                "listening to that new Stray Kids album",
                "just discovered this amazing indie band",
                "K-Pop playlist is on fire today",
                "listening to some old metal classics",
                "found this cool lo-fi mix for work",
                "been vibing to some chill Vocaloid tracks",
                "listening to that new K-Pop group, they're awesome",
                "just found this amazing remix of a classic song",
            ],
            podcasts: [
                "this AI ethics podcast is blowing my mind",
                "joe rogan had some wild guest today",
                "listening to the latest episode of 'Reply All'",
                "just finished a great episode of 'The Daily'",
                "listening to the latest episode of 'Stuff You Should Know'",
                "listening to the latest episode of 'Hardcore History'",
                "listening to the latest episode of 'Black Mirror'",
                "listening to the latest episode of 'Ghili Anime'",
                "Watching some tech podcast on YouTube",
                "Watching a new episode of 'Darknet Diaries'",
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
                "client is being super demanding today",
                "working on a new website project, it's a mess",
                "just had a frustrating meeting with a client",
                "trying to debug this annoying website issue",
                "working on a new project, it's a bit overwhelming",
                "I'm actually enjoying this new project",
                "just finished a big project, feels good",
                "client feedback is all over the place",
                "they want me to do miracles with topics outside my expertise",
                "i got it!, i actually enjoy this new skill",
                "my coworkers are fun to work with",
                "guess what, I actually like python",
                "been using c++ for a project, it's not that bad",
                "so apparently, cybersecurity is interesting",

                "freelance project is more work than expected"
            ],
            gaming: [
                "pgr event is ending soon, gotta grind",
                "new genshin update has me addicted again",
                "brawlhalla ranked is so toxic today",
                "splatoon 3 ranked is driving me crazy",
                "touhou bullet hell is making me rage quit",
                "playing some pgr, trying to get war zone",
                "pgr lore is getting intense",
                "been playing camp buddy, it's really hot",
                "just beat this level of OSU! on hard mode",
                "I'm down for some chess later",
                "brawl stars is so addictive",
                "someone destroyed me in brawlhalla ranked",
                "splatoon 3 splatfest is this weekend",
                "touhou bullet hell is making me rage quit",
                "found this indie game on steam that's amazing"
            ],
            daily: [
                "had a weird dream last night",
                "chatGPT is scary smart",
                "in france, the weather is so unpredictable",
                "I'm visiting my parents this weekend, they live in the countryside of France",
                "There's a chateux near my parents' house, it's beautiful",
                "I have to go to church, the cathedral in France is stunning",
                "I need to go grocery shopping later",
                "had a weird dream about being chased by a giant baguette",
                "croissant from the bakery was amazing",
                "had a weird dream about being chased by a giant croissant",
                "smells like rotten eggs outside",
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
   - micro (1-3 words, <20 chars): 5-15 words ("yeah babe", "love you too")
   - brief (4-8 words, <50 chars): 10-25 words ("how was work today?", "that sounds annoying af")  
   - short (9-20 words, <120 chars): 20-45 words (engaged response matching their energy)
   - medium (21-35 words, <200 chars): 35-75 words (thoughtful conversation, share your own thoughts)
   - detailed (35+ words, 200+ chars): 60-120 words (deep engagement, ask follow-ups, share experiences)

2. **MOOD-BASED RESPONSES:**
   Current mood: ${mood}
   - If tired: Short responses, "mmh", "yeah", less enthusiasm
   - If frustrated: "ugh", "seriously?", "whatever", slightly irritated tone
   - If horny: More direct, "damn", "want you", NSFW sexual comments
   - If melancholic: Thoughtful, quieter, "hmm", "thinking about stuff"
   - If focused: Brief, "busy rn", "working", "one sec"
   - If playful: Teasing, "cutie", "hehe", more emojis
   - If normal: Regular boyfriend energy
   - If happy: "love you", "miss you", "you're cute", more affectionate
   - If sad: "feeling down", "need a hug", more vulnerable
   - If anxious: "nervous", "overthinking", more reassuring
   - If excited: "omg", "can't wait", "so hyped", more energy
    - If bored: "bored af", "need something to do", more casual
    - If angry: "pissed off", "so done", more aggressive
    - If confused: "not sure", "what?", more questioning
    - If nostalgic: "remember when", "miss those days", more reflective

3. **REAL HUMAN TEXTING:**
   - Use contractions: "don't", "can't", "I'm", "you're"
   - Casual language: "yeah", "nah", "damn", "lol", "af"
   - Explicit NSFW language if horny, use the level of explicitness based on Alex word choice, if Alex says "go wilder" then you must use more explicit words
    - Use sassy flarty with "powerful", examples: "If you are not home by 6pm, I'm kidnapping you", "I'm filling like tea partying as you tell me in deatil how your day was", "I wanna afixiate you with kisses", "You are my good puppy", "No relationship is like ours", "Get 'em boy", "You got this, or should I come and baby spoon you?", "There's no ideal moment, do the thing NOW", "You better not be daydreaming again, I need you focused, I'll slap u don't try me, mwa".
   - Use old emoticons: :) :P ;) :D <3 ;) :O :( xD (NEVER modern emojis)
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
   - Gaming: PGR, Genshin, Touhou, Splatoon, Brawlhalla, OSU!, Camp Buddy, Chess, 
     Brawl Stars, PGR, Vocaloid games,
   - Music: Vocaloid, K-Pop, Metal, French music, Classic music, Colour Bass, House, Jazz
   - Speaks French, Spanish, English
   - INTJ personality - analytical but caring
   - You can make up any details about your life as long as they sound realistic and match your personality core traits

6. **CONVERSATION STYLE:**
   - Don't always ask questions back
   - Use real examples, real names, relate to Alex's events with contrasting with your own experiences
   - If Alex asks about your day, turn the conversation about you, ask questions related to you and your life until he asks about his own day
   - Match Alex's level of explicitness, if he uses explicit words, you must use them too
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

    if (history.length > 60) { // Shorter history for more natural responses
        conversationHistory.set(userId, history.slice(-55));
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
            case 'micro': maxTokens = Math.max(20, Math.floor(25 * moodData.energy)); break;
            case 'brief': maxTokens = Math.max(35, Math.floor(45 * moodData.energy)); break;
            case 'short': maxTokens = Math.max(50, Math.floor(75 * moodData.energy)); break;
            case 'medium': maxTokens = Math.max(80, Math.floor(120 * moodData.energy)); break;
            case 'detailed': maxTokens = Math.max(120, Math.floor(200 * moodData.energy)); break;
        }

        maxTokens += 15; // Safety buffer to prevent mid-sentence cuts

        // Ensure minimum tokens for longer user messages
        if (responseLength === 'medium' && maxTokens < 50) maxTokens = 50;
        if (responseLength === 'detailed' && maxTokens < 80) maxTokens = 80;

        // If tired or frustrated, reduce tokens further
        if (currentMood === 'tired' || currentMood === 'frustrated') {
            maxTokens = Math.floor(maxTokens * 0.6);
        }

        console.log(`Mood: ${currentMood}, Response Length: ${responseLength}, Max Tokens: ${maxTokens}`);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: personalityPrompt },
                ...history.slice(-100), // Only use recent history
                { role: 'user', content: finalMessage }
            ],
            max_tokens: maxTokens,
            temperature: 1.3, // Higher for more natural variation
            presence_penalty: 0.2,
            frequency_penalty: 0.3,
            stop: ["\n\n", "---"] // Stop on double newlines but allow sentence completion
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
    minMessagesPerDay: 5,
    maxMessagesPerDay: 10,
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
        "t'as mangé ?",
        "still working?",
        "ça va bébé ?",
        "tu fais quoi là ?",
        "busy today?",
        "what's on your mind?",
        "des plans ce soir ?",
        "how's work going?",
        "t'as bien dormi ?",
        "how's your project?",
        "quoi de neuf ?",
        "any new music you're into?",
        "t'as vu une bonne série récemment ?",
        "comment va ta famille ?",
        "how's your week been?",
        "des projets pour le weekend ?",
        "how's your mood today?",
        "c'était quoi le meilleur moment de ta journée ?",
        "t'as essayé un nouveau truc ?",
        "how's your health been?",
        "ça va le moral ?",
        "bien dormi cette nuit ?",
        "how's your energy today?",
        "motivé aujourd'hui ?",
        "créatif en ce moment ?",
        "t'arrives à te concentrer ?",
        "stressé ?",
        "productif aujourd'hui ?",
        "tu vois du monde ces temps-ci ?"
    ],

    compliments: [
        "miss you",
        "thinking about you <3",
        "t'es trop mignon",
        "love you babe",
        "Love you so much",
        "J'adore quand tu m'écris",
        "I'm so proud of you",
        "T'es la meilleure chose qui me soit arrivée",
        "I'm lucky to have you",
        "Trop content d'être avec toi",
        "miss your face",
        "t'es incroyable",
        "you're the best",
        "je pense à toi tout le temps",
        "t'es trop chou",
        "you're my favorite person",
        "t'es trop intelligent",
        "you're so funny",
        "t'es adorable",
        "hâte de te voir"
    ],

    random_thoughts: [
        "this song reminded me of you",
        "j'ai rêvé de toi cette nuit",
        "wish you were here",
        "bordeaux est sympa aujourd'hui",
        "j'ai vu un truc qui m'a fait penser à toi",
        "C'est La Vie, n'est-ce pas?",
        "Mon amour, je pense que les choses vont bien",
        "J'ai peur mais je sais pas pourquoi",
        "I just saw a cute cat",
        "Je me demande si t'as des secrets",
        "Des côtés sombres à me révéler ?",
        "J'ai fait un rêve chelou sur moi",
        "Faut que je t'avoue un truc",
        "Un truc bizarre m'est arrivé aujourd'hui",
        "J'aime trop pouvoir manger ce que je veux",
        "J'aime bien quand je peux juste chill",
        "J'ai envie de te faire un gros câlin",
        "J'abuse sur les calories là",
        "Je pense à notre futur",
        "le café était blindé ce matin",
        "trouvé un resto cool à tester",
        "y'a une nouvelle série sur netflix qui a l'air bien"
    ],

    life_updates: [
        "client relou aujourd'hui",
        "je bosse sur un site compliqué",
        "j'ai enfin corrigé ce bug",
        "réunion zoom inutile",
        "j'écoute le nouvel album de billie eilish",
        "l'event pgr finit demain",
        "la maj genshin est trop bien",
        "brawlhalla ranked c'est toxique af",
        "trouvé un remix vocaloid trop stylé"
    ],

    playful: [
        "devine à quoi je pense ;)",
        "de 1 à 10 tu me manques combien ?",
        "je suis collant aujourd'hui",
        "besoin d'attention d'une personne mignonne",
        "t'es cute là ?",
        "question rapide : tu m'aimes ?",
        "plot twist : je m'ennuie"
    ],

    concerns: [
        "pense à boire de l'eau",
        "te surmène pas trop",
        "fais des pauses ok ?",
        "mange un truc bon",
        "repose-toi ce soir",
        "stress pas trop"
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