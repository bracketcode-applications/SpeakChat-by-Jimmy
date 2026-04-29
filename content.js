// content.js

(function () {
    'use strict';

    console.log('🚀 SpeakChat EXT iniciado');

    const DEBUG = true;
    const log = (...args) => DEBUG && console.log('[SpeakChat]', ...args);

    let seen = new Set();

    const IGNORED_USERS = [
        'Tango Happy Hour',
        'Battle Results:',
        'Top Gifter:'
    ];

    let isEnabled = true;

    let lastUser = null;
    let lastTime = 0;
    const RESET_TIME = 10000;

    let speechQueue = [];
    let isSpeaking = false;

    let currentGiftAudio = null;

    let gifterMode = false;
    let blacklist = [];
    let gifters = new Set();

    // 🧼 limpiar texto + emojis
    function cleanText(text) {
        if (!text) return '';
        return text
            .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // 🗣 hablar
    function speak(text, user = null) {
        if (!isEnabled) return;

        const now = Date.now();

        if (now - lastTime > RESET_TIME) {
            lastUser = null;
        }

        let finalText = text;

        if (user && user !== lastUser) {
            finalText = `${user} dice: ${text}`;
            lastUser = user;
        }

        lastTime = now;

        speechQueue.push(finalText);
        processQueue();
    }

    // 🔊 procesar cola
    function processQueue() {
        if (!isEnabled) return;
        if (isSpeaking || !speechQueue.length) return;

        chrome.storage.sync.get(['voice', 'rate', 'pitch'], (settings) => {

            const voices = speechSynthesis.getVoices();
            if (!voices.length) return;

            const text = speechQueue.shift();
            const utter = new SpeechSynthesisUtterance(text);

            if (settings.voice && voices[settings.voice]) {
                utter.voice = voices[settings.voice];
            }

            utter.rate = parseFloat(settings.rate) || 1;
            utter.pitch = parseFloat(settings.pitch) || 1;

            isSpeaking = true;

            utter.onend = () => {
                isSpeaking = false;
                processQueue();
            };

            utter.onerror = () => {
                isSpeaking = false;
                processQueue();
            };

            speechSynthesis.speak(utter);
            log('🗣', text);
        });
    }

    // 🎁 manejar regalo
    function handleGift(username, coins) {

    chrome.storage.sync.get(['giftSounds'], (data) => {

        if (!data.giftSounds) return;

        const coinValue = parseInt(coins.replace(/\./g, ''));

        const range = data.giftSounds.find(r =>
            coinValue >= r.min && coinValue <= r.max
        );

        if (!range) return;

        gifters.add(username);

        // 🗣 mensaje a decir
        const speakMessage = () => {
            if (range.message && range.message.trim().length > 0) {
                const msg = range.message
                    .replace('{user}', username)
                    .replace('{coins}', coins);

                speak(msg);
            }
        };

        // 🛑 detener audio anterior
        if (currentGiftAudio) {
            currentGiftAudio.pause();
            currentGiftAudio = null;
        }

        // 🔥 CASO 1: SIN AUDIO
        if (!range.audio || range.audio === 'none') {
            log('🎁 regalo sin audio → solo voz');
            speakMessage();
            return;
        }

        // 🔥 CASO 2: CON AUDIO
        const path = chrome.runtime.getURL(`audios/${range.audio}`);
        const audio = new Audio(path);

        currentGiftAudio = audio;

        audio.onended = () => {
            currentGiftAudio = null;
            speakMessage();
        };

        audio.onerror = () => {
            // ⚠️ si falla el audio → igual hablar
            currentGiftAudio = null;
            speakMessage();
        };

        audio.play();

        log('🎁 regalo con audio:', { username, coins, audio: range.audio });
    });
}

    // 🔍 contenedor chat
    function getChatContainer() {
        return document.querySelector('[data-testid="scrollable"]');
    }

    // 🧠 parsear evento
    function parseEvent(el) {

        const spans = el.querySelectorAll('span');
        const svgs = el.querySelectorAll('svg');

        const texts = [];

        spans.forEach(s => {
            const t = cleanText(s.innerText);
            if (t) texts.push(t);
        });

        if (!texts.length) return null;

        // 🎁 regalo
        if (svgs.length > 0) {

            let coins = null;

            texts.forEach(t => {
                const numeric = t.replace(/\./g, '');
                if (/^\d+$/.test(numeric)) {
                    coins = t;
                }
            });

            if (coins) {
                const username = texts.find(t => t.length <= 25);

                return {
                    type: 'gift',
                    username,
                    coins
                };
            }
        }

        // 💬 chat
        // 💬 chat
        if (texts.length >= 2) {

            const username = texts[0];
            const message = texts[texts.length - 1];

            // 🚫 vacío (solo emojis)
            if (!message || message.trim().length === 0) return null;

            // 🚫 mensaje igual al username (bug típico Tango)
            if (message.toLowerCase() === username.toLowerCase()) return null;

            return {
                type: 'chat',
                username,
                message
            };
        }

        return null;
    }

    // 🔄 scan principal
    function scan() {

        if (!isEnabled) return;

        const container = getChatContainer();
        if (!container) return;

        const events = container.querySelectorAll('[data-testid^="chat-event"]');

        events.forEach(el => {

            const id = el.getAttribute('data-testid');
            if (!id || seen.has(id)) return;

            seen.add(id);

            const data = parseEvent(el);
            if (!data) return;

            // 🎁 REGALO
            if (data.type === 'gift') {

                lastUser = null;

                handleGift(data.username, data.coins);

                return;
            }

            // 💬 CHAT
            if (data.type === 'chat') {

                // 🚫 ignorar combos tipo "x2"
                const comboMatch = data.message.trim().match(/^x\s?\d+$/i);
                if (comboMatch) return;

                // 🚫 seguridad extra (mensaje vacío)
                if (!data.message || data.message.trim().length === 0) return;

                // 🚫 blacklist
                if (blacklist.some(u => u.toLowerCase() === data.username.toLowerCase())) return;

                // 🎁 modo gifter
                if (gifterMode && !gifters.has(data.username)) return;

                if (IGNORED_USERS.includes(data.username)) return;

                if (data.message.toLowerCase().includes('nuevo seguidor')) {
                    lastUser = null;
                    speak(`Muchas Gracias ${data.username} por Seguirme`);
                    return;
                }

                if (data.message.includes('empezó a ver')) return;

                speak(data.message, data.username);
            }
        });
    }

    // 🔄 escuchar cambios
    function listenSettings() {
        chrome.storage.onChanged.addListener((changes) => {

            if (changes.enabled) {
                isEnabled = changes.enabled.newValue;

                if (!isEnabled) {
                    speechSynthesis.cancel();
                    speechQueue = [];
                    isSpeaking = false;

                    if (currentGiftAudio) {
                        currentGiftAudio.pause();
                        currentGiftAudio = null;
                    }
                }
            }

            if (changes.gifterMode) {
                gifterMode = changes.gifterMode.newValue;
            }

            if (changes.blacklist) {
                blacklist = changes.blacklist.newValue || [];
            }
        });
    }

    // 🎤 esperar voces
    function waitVoices() {
        return new Promise(resolve => {
            const voices = speechSynthesis.getVoices();
            if (voices.length) return resolve();
            speechSynthesis.onvoiceschanged = resolve;
        });
    }

    async function init() {

        chrome.storage.sync.get(['enabled', 'gifterMode', 'blacklist'], (data) => {
            isEnabled = data.enabled !== false;
            gifterMode = data.gifterMode || false;
            blacklist = data.blacklist || [];
        });

        listenSettings();

        await waitVoices();

        log('🚀 SpeakChat corriendo');

        setInterval(scan, 600);
    }

    init();

})();