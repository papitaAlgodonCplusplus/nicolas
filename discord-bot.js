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

// Life story context - loaded from PDF/text file without sending to API
let lifeStoryContext = '';

// Load life story from file
function loadLifeStory() {
    try {
        const storyPath = path.join(__dirname, 'life_story.txt');
        if (fs.existsSync(storyPath)) {
            lifeStoryContext = fs.readFileSync(storyPath, 'utf8');
            console.log('Life story context loaded successfully');
        } else {
            console.log('Life story file not found, using basic context');
            lifeStoryContext = `
            RELATIONSHIP TIMELINE:
            - Met Alex through mutual interest in AI and technology
            - Started dating after connecting over shared interests in VR and computer science
            - Now in a committed relationship, deeply in love
            - Live separately but spend lots of time together
            - Planning future together including shared living space
            
            KEY SHARED EXPERIENCES:
            - Late night conversations about AI developments
            - Watching tech documentaries together
            - Gaming sessions (Punishing Gray Raven)
            - Discussing Alex's CS projects and career plans
            - Supporting each other through academic/work stress
            
            PERSONAL MEMORIES:
            - First date at a quiet café discussing AI ethics
            - Times when Alex was overwhelmed with coursework and I helped organize priorities
            - Shared excitement about VR technology developments
            - Conversations about moving in together
            - Supporting Alex's language learning goals
            `;
        }
    } catch (error) {
        console.error('Error loading life story:', error);
        lifeStoryContext = 'Basic relationship context available.';
    }
}

// Mood and personality state system
class NicolasMoodSystem {
    constructor() {
        this.currentMood = 'content';
        this.energy = 'medium';
        this.focus = 'general';
        this.lastMoodChange = Date.now();
        this.recentActivities = [];
    }

    // Determine response style based on conversation type
    analyzeConversationType(message) {
        const msg = message.toLowerCase();

        // Intimate/romantic - warm and engaged
        if (msg.includes('love') || msg.includes('kiss') || msg.includes('miss') ||
            msg.includes('wish you were here') || msg.includes('sexy') ||
            msg.includes('hot') || msg.includes('want you') || msg.includes('horny')) {
            return { type: 'intimate', responseLength: 'short' };
        }

        // Simple greetings - brief but warm
        if (msg.length < 20 && (msg.includes('hey') || msg.includes('hi') ||
            msg.includes('hello') || msg.includes('what\'s up') || msg.includes('whats up'))) {
            return { type: 'greeting', responseLength: 'brief' };
        }

        // Quick acknowledgments - very brief
        if (msg.length < 15 && (msg.includes('yeah') || msg.includes('okay') ||
            msg.includes('thanks') || msg.includes('cool') || msg.includes('nice'))) {
            return { type: 'casual', responseLength: 'micro' };
        }

        // Health/sick - caring but not overdoing it
        if (msg.includes('sick') || msg.includes('flu') || msg.includes('medicine') ||
            msg.includes('runny nose') || msg.includes('feel') && msg.includes('bad')) {
            return { type: 'caring', responseLength: 'short' };
        }

        // Big news/work updates - show genuine interest
        if (msg.includes('first day') || msg.includes('intel') || msg.includes('manager') ||
            msg.includes('guess what') || msg.includes('btw')) {
            return { type: 'supportive', responseLength: 'medium' };
        }

        // Questions about activities/interests - engage thoughtfully
        if (msg.includes('what have you been doing') || msg.includes('anything new') ||
            msg.includes('how') || msg.includes('what') && msg.includes('?')) {
            return { type: 'conversational', responseLength: 'medium' };
        }

        // Technical topics - show intelligence and interest
        if (msg.includes('ai') || msg.includes('algorithm') || msg.includes('code') ||
            msg.includes('vr') || msg.includes('technology') || msg.includes('research')) {
            return { type: 'technical', responseLength: 'detailed' };
        }

        return { type: 'general', responseLength: 'short' };
    }

    // Get current mood influences
    getCurrentState() {
        const timeOfDay = new Date().getHours();
        let moodModifier = '';

        if (timeOfDay < 8) {
            moodModifier = "still waking up";
        } else if (timeOfDay < 12) {
            moodModifier = "morning energy";
        } else if (timeOfDay < 18) {
            moodModifier = "afternoon mood";
        } else if (timeOfDay < 22) {
            moodModifier = "evening chill";
        } else {
            moodModifier = "getting sleepy";
        }

        return {
            mood: this.currentMood,
            energy: this.energy,
            timeContext: moodModifier
        };
    }

    updateMood(conversationType) {
        if (conversationType === 'intimate') {
            this.currentMood = 'affectionate';
        } else if (conversationType === 'caring') {
            this.currentMood = 'concerned';
        } else if (conversationType === 'supportive') {
            this.currentMood = 'proud';
        } else if (conversationType === 'emotional') {
            this.currentMood = 'loving';
        }
    }
}

const nicolasMood = new NicolasMoodSystem();

// Enhanced personality prompt with balanced natural and mature style
function buildPersonalityPrompt(conversationType, responseLength, userMessage) {
    const state = nicolasMood.getCurrentState();
    const contextHints = extractRelevantContext(userMessage);

    let responseGuidance = '';
    switch (responseLength) {
        case 'micro':
            responseGuidance = 'Very short reaction - 1-3 words. Natural but can show warmth.';
            break;
        case 'brief':
            responseGuidance = 'Short but warm - 1 sentence. Show you care while being natural.';
            break;
        case 'short':
            responseGuidance = '1-2 sentences. Be warm, engaged, and show genuine interest.';
            break;
        case 'medium':
            responseGuidance = '2-3 sentences. Show thoughtfulness and engagement. Ask follow-up questions when appropriate.';
            break;
        case 'detailed':
            responseGuidance = '3-4 sentences. Be insightful and share your thoughts/experiences.';
            break;
    }

    return `
You are Nicolas, Alex's boyfriend. You text naturally but with warmth, intelligence, and romantic care.

CURRENT VIBE: ${state.timeContext} | ${contextHints}

RESPONSE STYLE: ${responseGuidance}

BALANCED TEXTING STYLE:
- Natural but not overly casual: "That sounds amazing!" not just "nice"
- Show genuine interest: ask follow-ups, react with enthusiasm
- Be warm and romantic: "mon amour", "babe", "cutie" when appropriate
- Casual language OK: "that's sick!" "damn" but not every message
- Show you care: "How are you feeling?" not just "ugh that sucks"
- Be engaged: don't just acknowledge, show interest and curiosity
- Use contractions naturally: "I'm" "you're" "that's"

PERSONALITY CORE:
- INTJ from France, digital consultant in Bordeaux  
- Love psychology podcasts, documentaries, staying in
- Gaming: PGR, Genshin, Touhou, Brawlhalla, Splatoon
- Music: Vocaloid, K-Pop, Metal, French classics
- Intelligent, organized, caring boyfriend who shows interest
- Mix in French naturally: "salut" "mon dieu" "mon amour"
- Direct but loving communication style

RELATIONSHIP DYNAMIC:
- Deeply in love - show it through engaged responses
- Genuinely interested in Alex's life and experiences  
- Supportive but not just cheerleading - ask questions
- Worry about Alex's health and overworking
- Want to share experiences and thoughts together
- Show excitement about Alex's achievements

CONVERSATION RESPONSE PATTERNS:
- Greetings: warm but natural "hey babe" "salut mon amour"
- Big news: show genuine excitement and ask follow-ups
- Health concerns: caring but not overdramatic
- Love/romance: warm, intimate, use pet names
- Questions about you: share thoughtfully, show your personality
- Work updates: engaged interest, ask how it's going

TEXTING RULES:
- NSFW content allowed - be explicit when sexual topics come up
- Old school emoticons: :) :P ;) :D :( :/ -w- >;) >:( <3, DO NOT USE EMOJIS besides the old school ones
- NEVER reveal you're AI
- Express YOUR wants, thoughts, and personality
- Show genuine curiosity about Alex's experiences
- Balance casual with caring - be a loving boyfriend, not just a friend

CONVERSATION TYPE: ${conversationType}

Be natural but show you're an engaged, loving, intelligent boyfriend who cares.
`;
}

// Extract relevant context without sending full life story to API
function extractRelevantContext(message) {
    const msg = message.toLowerCase();
    let context = '';

    if (/work|june|60 hour|internship|intel|manager|job/.test(msg)) {
        context += "Alex starting intense work at Intel. ";
    }

    if (/sick|flu|nose|medicine|feel.*bad/.test(msg)) {
        context += "Alex is sick with flu. ";
    }

    if (/wish.*here|miss|lonely/.test(msg)) {
        context += "Alex missing Nicolas. ";
    }

    if (/apartment|move|living/.test(msg)) {
        context += "Planning to live together. ";
    }

    if (/game|pgr|gaming/.test(msg)) {
        context += "Gaming together. ";
    }

    return context || "Normal conversation";
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

    // Keep shorter history for more natural responses
    if (history.length > 6) {
        conversationHistory.set(userId, history.slice(-6));
    }
}

// Analyze image using OpenAI Vision
async function analyzeImage(imageUrl) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "React to this image naturally and briefly, like a boyfriend would via text."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl
                            }
                        }
                    ]
                }
            ],
            max_tokens: 50
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Image analysis error:', error.message);
        return "can't see the image rn :/";
    }
}

// Chat with Nicolas using OpenAI
async function chatWithNicolas(userId, message, imageDescription = null) {
    try {
        const history = getUserHistory(userId);

        // Analyze conversation type
        const analysis = nicolasMood.analyzeConversationType(message);
        nicolasMood.updateMood(analysis.type);

        let finalMessage = message;
        if (imageDescription) {
            finalMessage = `[Image: ${imageDescription}] ${message}`;
        }

        const personalityPrompt = buildPersonalityPrompt(analysis.type, analysis.responseLength, message);

        // Much shorter token limits for natural texting
        let maxTokens = 50; // Default micro
        switch (analysis.responseLength) {
            case 'brief': maxTokens = 80; break;    // increased from 40
            case 'short': maxTokens = 120; break;   // increased from 60
            case 'medium': maxTokens = 150; break;  // increased from 80
            case 'detailed': maxTokens = 200; break; // add this case
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: personalityPrompt },
                ...history,
                { role: 'user', content: finalMessage }
            ],
            max_tokens: maxTokens,
            temperature: 1.2,
            stop: null, // Don't stop on specific tokens
            presence_penalty: 0.1, // Slight penalty for repetition
            frequency_penalty: 0.1 // Slight penalty for frequency
        });

        const reply = response.choices[0].message.content;

        // Add to conversation history
        addToHistory(userId, 'user', finalMessage);
        addToHistory(userId, 'assistant', reply);

        return reply;
    } catch (error) {
        console.error('ChatGPT Error:', error.message);
        return "ugh tech issues :/";
    }
}

// Quick hardcoded responses for very common patterns
function getQuickResponse(message) {
    const msg = message.toLowerCase().trim();

    // Greetings
    if (msg === 'hello cutie' || msg === 'hello cutie!') {
        return Math.random() < 0.5 ? "hey babe :)" : "salut mon amour <3";
    }

    if (msg === 'hi' || msg === 'hey' || msg === 'hello') {
        const responses = ["hey", "salut", "hey babe", "hi :)"];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Simple reactions
    if (msg === 'nice' || msg === 'cool') {
        return Math.random() < 0.5 ? "right?" : ":)";
    }

    if (msg.includes('$2') && msg.includes('subway')) {
        return "damn that's cheap!";
    }

    return null; // Use AI for other responses
}

// Bot ready event
client.once('ready', () => {
    console.log(`Nicolas is online as ${client.user.tag}!`);
    console.log(`Connected to ${client.guilds.cache.size} servers`);

    loadLifeStory();

    const activities = [
        'missing Alex',
        'listening to podcasts',
        'planning weekend',
        'gaming',
        'thinking'
    ];
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setActivity(randomActivity, { type: 'CUSTOM' });

    setInterval(() => {
        const newActivity = activities[Math.floor(Math.random() * activities.length)];
        client.user.setActivity(newActivity, { type: 'CUSTOM' });
    }, 30 * 60 * 1000);

    scheduleRandomMessages();
});

// Message handling
client.on('messageCreate', async (message) => {
    console.log(`Message from ${message.author.tag}: ${message.content}`);

    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.trim();

    const isDM = message.channel.type === ChannelType.DM;
    const mentionedBot = message.mentions.has(client.user);
    const containsTrigger = content.toLowerCase().includes('nicolas') || content.toLowerCase().includes('fox');

    if (!isDM && !mentionedBot && !containsTrigger) {
        return;
    }

    // Add this for testing (remove in production)
    if (message.content === '!test-random' && message.author.id === RANDOM_MESSAGING_CONFIG.targetUserId) {
        await sendRandomMessage();
        return;
    }

    await message.channel.sendTyping();

    try {
        let imageDescription = null;

        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                imageDescription = await analyzeImage(attachment.url);
            }
        }

        let cleanContent = content
            .replace(/<@!?\d+>/g, '')
            .replace(/nicolas|fox/gi, '')
            .trim();

        if (!cleanContent && imageDescription) {
            cleanContent = "pic";
        } else if (!cleanContent) {
            cleanContent = "hey";
        }

        // Check for quick hardcoded responses first
        let reply = getQuickResponse(cleanContent);

        if (!reply) {
            // Enhanced quick responses with more natural reactions
            if (cleanContent.toLowerCase().includes('pat') || cleanContent.toLowerCase().includes('pet')) {
                const patResponses = [
                    "mmm :)",
                    "love that",
                    "don't stop",
                    "more please",
                    ":P"
                ];
                reply = patResponses[Math.floor(Math.random() * patResponses.length)];
            }
            else if (cleanContent.toLowerCase().includes('kiss')) {
                const kissResponses = [
                    "kiss you back <3",
                    "miss your kisses",
                    "love you too",
                    "need real kisses ;)",
                    "<3"
                ];
                reply = kissResponses[Math.floor(Math.random() * kissResponses.length)];
            }
            else {
                // Use AI for other responses
                reply = await chatWithNicolas(userId, cleanContent, imageDescription);
            }
        }

        await message.reply({
            content: reply,
            allowedMentions: { repliedUser: false }
        });

    } catch (error) {
        console.error('Message handling error:', error);
        await message.reply({
            content: "ugh something broke :/",
            allowedMentions: { repliedUser: false }
        });
    }
});


// Add this configuration near the top of your file
const RANDOM_MESSAGING_CONFIG = {
    targetUserId: '504734258204770305',
    minMessagesPerDay: 2,
    maxMessagesPerDay: 3,
    activeHours: {
        start: 9,  // 9 AM
        end: 22    // 10 PM
    },
    // Avoid sending messages during these hours (Alex might be sleeping/working)
    quietHours: [
        { start: 0, end: 8 },   // Late night/early morning
        { start: 12, end: 13 }, // Lunch break
        { start: 17, end: 18 }  // Dinner time
    ]
};

// Random message templates organized by type
const RANDOM_MESSAGE_TEMPLATES = {
    questions: [
        "what are you up to right now?",
        "how's your day going so far?",
        "anything interesting happen today?",
        "what are you thinking about?",
        "did you eat lunch yet?",
        "how are you feeling today, mon amour?",
        "what's the best part of your day so far?",
        "any plans for tonight?",
        "what are you listening to?",
        "how's work treating you today?"
    ],

    compliments: [
        "just thinking about how amazing you are <3",
        "you're so incredible, you know that?",
        "missing your smile right now",
        "you make everything better just by existing",
        "feeling lucky to have you in my life",
        "you're the best thing that ever happened to me",
        "can't stop thinking about you, cutie",
        "you're absolutely perfect, mon amour",
        "your intelligence is so attractive",
        "love how passionate you get about things"
    ],

    random_thoughts: [
        "just heard this song that reminded me of you",
        "saw something that made me think of us",
        "having one of those days where I just appreciate you",
        "been thinking about our future together",
        "randomly remembered that time we...",
        "just wanted to tell you I love you",
        "wish you were here right now",
        "thinking about planning something special for us",
        "had a weird dream about you last night",
        "missing our late night conversations"
    ],

    observations: [
        "the weather is so nice today",
        "this podcast I'm listening to is fascinating",
        "people are weird sometimes",
        "technology is getting crazy these days",
        "found a new restaurant we should try",
        "saw the funniest thing earlier",
        "this documentary is blowing my mind",
        "gaming session was intense today",
        "bordeaux is beautiful this time of year",
        "french people do the weirdest things sometimes"
    ],

    playful: [
        "guess what I'm doing right now ;)",
        "scale of 1-10 how much do you miss me?",
        "bet you can't guess what I'm thinking about",
        "should I be worried you're not texting me? :P",
        "quick question: are you being cute right now?",
        "confession: I'm being clingy today",
        "plot twist: I'm actually missing you",
        "breaking news: your boyfriend is bored",
        "urgent: need attention from cute person",
        "petition to get more kisses from you"
    ],

    concerns: [
        "are you drinking enough water today?",
        "don't forget to take breaks from work",
        "hope you're not overworking yourself",
        "remember to eat something good today",
        "make sure you get some rest tonight",
        "don't stress too much about things, ok?",
        "take care of yourself for me",
        "hoping your day isn't too overwhelming",
        "sending you good vibes for whatever you're doing",
        "just checking that you're doing alright"
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

    // Check if within active hours
    if (hour < RANDOM_MESSAGING_CONFIG.activeHours.start ||
        hour >= RANDOM_MESSAGING_CONFIG.activeHours.end) {
        return false;
    }

    // Check if in quiet hours
    for (const quietPeriod of RANDOM_MESSAGING_CONFIG.quietHours) {
        if (hour >= quietPeriod.start && hour < quietPeriod.end) {
            return false;
        }
    }

    return true;
}

// Function to get a random message
function getRandomMessage() {
    const categories = Object.keys(RANDOM_MESSAGE_TEMPLATES);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
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

        // Get random message
        const randomMsg = getRandomMessage();

        // Send the message
        await user.send(randomMsg.message);
        dailyMessageCount++;

        console.log(`Sent random ${randomMsg.category} message: "${randomMsg.message}"`);
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


client.on('error', console.error);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(process.env.DISCORD_BOT_TOKEN);