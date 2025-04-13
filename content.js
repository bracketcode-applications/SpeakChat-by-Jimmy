// ==UserScript==
// @name         Tango.me Chat Speaker Pro
// @description  Reproduce mensajes y regalos con voz personalizable y efectos de audio
// @author       Jimmy - Microondas Creativos
// @match        https://tango.me/*
// @grant        none
// @version      2.2
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURACIÓN INICIAL ====================
    let CONFIG = {
        ENABLE_COIN_MESSAGES: true,
        SELECTED_VOICE: null,
        IGNORED_PHRASES: ['empezó a ver', 'entró a la sala', 'salió de la sala'],
        AUDIO_BASE_URL: chrome.runtime.getURL('audios/'),
        COIN_RANGES: {
            1: [1000, 5000],
            2: [5001, 10000],
            3: [10001, Infinity]
        },
        COIN_MESSAGES: {
            1: '¡Qué generosidad!',
            2: '¡Impresionante regalo!',
            3: '¡Espectacular regalo!'
        },
        GIFT_AUDIOS: {
            1: null,
            2: null,
            3: null
        }
    };

    // ==================== VARIABLES GLOBALES ====================
    const readMessagesSet = new Set();
    let lastSpokenUser = null;

    // ==================== FUNCIONES PRINCIPALES ====================

    function cleanText(text, isUsername = false) {
        if (!text) return '';
        return isUsername 
            ? text.replace(/[\p{Emoji}]/gu, '').trim()
            : text.trim();
    }

    /**
     * Reproduce un audio para regalos
     * @param {string} audioFile - Nombre del archivo de audio (ej. "audio0.mp3")
     */
    function playGiftAudio(audioFile) {
        if (!audioFile) return;
        
        const audio = new Audio(CONFIG.AUDIO_BASE_URL + audioFile);
        audio.play().catch(e => {
            console.error("Error al reproducir audio:", e);
            speak("Error al reproducir efecto de audio");
        });
    }

    function speak(text, currentUser = null) {
        if (!window.speechSynthesis || !text) return;

        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;

        let selectedVoice = CONFIG.SELECTED_VOICE 
            ? voices.find(v => v.name === CONFIG.SELECTED_VOICE)
            : voices[0];

        if (!selectedVoice) selectedVoice = voices[0];

        const finalText = currentUser 
            ? (currentUser === lastSpokenUser 
                ? `: ${text}` 
                : `${cleanText(currentUser, true)}: ${text}`)
            : text;

        const utterance = new SpeechSynthesisUtterance(finalText);
        utterance.voice = selectedVoice;
        utterance.rate = 1.0;

        window.speechSynthesis.cancel(); // Detener habla previa
        window.speechSynthesis.speak(utterance);
        lastSpokenUser = currentUser;
    }

    // ==================== PROCESAMIENTO DE MENSAJES ====================

    function processChatMessage(element) {
        const usernameElement = element.querySelector('.peyuZ span');
        const messageElement = element.querySelector('.KR99L span');

        if (!usernameElement || !messageElement) return;

        const username = usernameElement.innerText;
        const message = messageElement.innerText;

        if (CONFIG.IGNORED_PHRASES.some(phrase => message.includes(phrase))) {
            return;
        }

        const fullMessage = `${username}: ${message}`;
        if (!readMessagesSet.has(fullMessage)) {
            readMessagesSet.add(fullMessage);
            speak(message, username);
        }
    }

    function processGift(element) {
        if (!CONFIG.ENABLE_COIN_MESSAGES) return;

        const usernameElement = element.closest('.J_XGe').querySelector('.peyuZ span');
        const priceElement = element.querySelector('.FJnYG');

        if (!usernameElement || !priceElement) return;

        const username = usernameElement.innerText;
        const priceText = priceElement.innerHTML.split('</svg>')[1]?.trim();
        const coins = parseInt(priceText, 10) || 0;

        let customMessage = '';
        let audioFile = null;

        for (const [key, range] of Object.entries(CONFIG.COIN_RANGES)) {
            if (coins >= range[0] && coins <= range[1]) {
                customMessage = CONFIG.COIN_MESSAGES[key];
                audioFile = CONFIG.GIFT_AUDIOS[key];
                break;
            }
        }

        const giftMessage = `${cleanText(username, true)} ha enviado ${priceText} monedas. ${customMessage}`;
        if (!readMessagesSet.has(giftMessage)) {
            readMessagesSet.add(giftMessage);
            speak(giftMessage);
            if (audioFile) {
                playGiftAudio(audioFile); // Reproducir audio después del mensaje
            }
        }
    }

    // ==================== MANEJO DE CONFIGURACIÓN ====================

    function loadConfig() {
        chrome.storage.sync.get([
            'selectedVoice',
            'coinRanges',
            'coinMessages',
            'giftAudios'
        ], (result) => {
            if (result.selectedVoice) {
                CONFIG.SELECTED_VOICE = result.selectedVoice;
            }
            if (result.coinRanges) {
                Object.assign(CONFIG.COIN_RANGES, result.coinRanges);
            }
            if (result.coinMessages) {
                Object.assign(CONFIG.COIN_MESSAGES, result.coinMessages);
            }
            if (result.giftAudios) {
                Object.assign(CONFIG.GIFT_AUDIOS, result.giftAudios);
            }
        });
    }

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'instantUpdate' && request.config) {
            if (request.config.selectedVoice !== undefined) {
                CONFIG.SELECTED_VOICE = request.config.selectedVoice;
            }
            if (request.config.coinRanges) {
                Object.assign(CONFIG.COIN_RANGES, request.config.coinRanges);
            }
            if (request.config.coinMessages) {
                Object.assign(CONFIG.COIN_MESSAGES, request.config.coinMessages);
            }
            if (request.config.giftAudios) {
                Object.assign(CONFIG.GIFT_AUDIOS, request.config.giftAudios);
            }
        }
    });

    // ==================== OBSERVADOR DE CAMBIOS ====================

    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!mutation.addedNodes.length) return;

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    const chatElements = node.querySelectorAll?.('.J_XGe') || [];
                    chatElements.forEach(element => {
                        processChatMessage(element);
                        processGift(element);
                    });
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== INICIALIZACIÓN ====================

    function initVoices() {
        return new Promise((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(voices);
            } else {
                window.speechSynthesis.onvoiceschanged = () => {
                    resolve(window.speechSynthesis.getVoices());
                };
            }
        });
    }

    (async function init() {
        await initVoices();
        loadConfig();
        initObserver();
        
        // Sincronización periódica de configuración
        setInterval(loadConfig, 5000);
    })();

    window.speechSynthesis.getVoices(); // Forzar carga inicial
})();