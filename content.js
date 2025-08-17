// content.js
// Este script se inyecta en la página tango.me para interactuar con el DOM y procesar mensajes/regalos.
// ==UserScript==
// @name         TNG SpeakChat
// @description  Reproduce mensajes y regalos con voz personalizable y efectos de audio, para la pagina tango.me
// @author       Jimmy - Microondas Creativos
// @match        https://tango.me/*
// @grant        none
// @version      3.1.2 // Versión actualizada para reflejar los nuevos cambios de HTML
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURACIÓN INICIAL ====================
    let CONFIG = {
        ENABLE_COIN_MESSAGES: true,
        SELECTED_VOICE: null,
        GIFTER_MODE: false,
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
        },
        // Nuevas propiedades de configuración para voz
        SPEECH_RATE: 1.0,
        SPEECH_VOLUME: 1.0,
        SPEECH_PITCH: 1.0
    };

    // ==================== VARIABLES GLOBALES ====================
    const readMessagesSet = new Set();
    const giftSenders = new Set();
    let lastSpokenUser = null;

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * Limpia el texto de emojis y espacios extra.
     * @param {string} text - El texto a limpiar.
     * @param {boolean} isUsername - Indica si el texto es un nombre de usuario (para limpieza específica).
     * @returns {string} El texto limpio.
     */
    function cleanText(text, isUsername = false) {
        if (!text) return '';
        if (isUsername) {
            // Elimina emojis de nombres de usuario
            return text.replace(/[\p{Emoji}]/gu, '').trim();
        }
        return text.trim();
    }

    /**
     * Reproduce un archivo de audio.
     * @param {string} audioFile - El nombre del archivo de audio a reproducir.
     */
    function playGiftAudio(audioFile) {
        if (!audioFile) return;

        const audio = new Audio(CONFIG.AUDIO_BASE_URL + audioFile);
        audio.play().catch(e => {
            console.error("SpeakChat: Error al reproducir audio:", e);
            speak("Error al reproducir efecto de audio");
        });
    }

    /**
     * Sintetiza y reproduce texto usando la API de SpeechSynthesis.
     * @param {string} text - El texto a reproducir.
     * @param {string|null} currentUser - El nombre de usuario que envió el mensaje, si aplica.
     */
    function speak(text, currentUser = null) {
        if (!window.speechSynthesis || !text) return;

        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            console.warn("SpeakChat: No hay voces de síntesis de voz disponibles.");
            return;
        }

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
        utterance.rate = CONFIG.SPEECH_RATE;
        utterance.volume = CONFIG.SPEECH_VOLUME;
        utterance.pitch = CONFIG.SPEECH_PITCH;

        console.log('SpeakChat: Reproduciendo mensaje con configuración:', {
            text: finalText,
            voice: selectedVoice ? selectedVoice.name : 'N/A',
            rate: utterance.rate,
            volume: utterance.volume,
            pitch: utterance.pitch
        });

        window.speechSynthesis.speak(utterance);
        lastSpokenUser = currentUser;
    }

    // ==================== PROCESAMIENTO GENERAL DE CHAT/REGALOS ====================

    /**
     * Procesa un elemento del DOM que representa un regalo o un mensaje de chat.
     * @param {HTMLElement} element - El elemento DOM principal del evento de chat (e.g., .J_XGe o .qv4zS).
     */
    function processChatEvent(element) {
        const giftPriceElement = element.querySelector('[data-testid="gift-price-coins-number"]');

        if (giftPriceElement) {
            if (!CONFIG.ENABLE_COIN_MESSAGES) return;

            const usernameElement = element.querySelector('.peyuZ span');

            if (!usernameElement) {
                console.warn("SpeakChat: No se encontró el nombre de usuario para el evento de regalo.", element);
                return;
            }

            const username = cleanText(usernameElement.innerText, true);
            let priceText = giftPriceElement.innerText.trim();

            priceText = priceText.replace(/\./g, '');
            const coins = parseInt(priceText, 10) || 0;

            giftSenders.add(username);

            let customMessage = '';
            let audioFile = null;

            for (const [key, range] of Object.entries(CONFIG.COIN_RANGES)) {
                if (coins >= range[0] && coins <= range[1]) {
                    customMessage = CONFIG.COIN_MESSAGES[key];
                    audioFile = CONFIG.GIFT_AUDIOS[key];
                    break;
                }
            }

            const giftMessage = `${username} ha enviado ${priceText} monedas. ${customMessage}`;

            if (!readMessagesSet.has(giftMessage)) {
                readMessagesSet.add(giftMessage);
                speak(giftMessage);
                if (audioFile) {
                    playGiftAudio(audioFile);
                }
            }
        } else {
            const usernameElement = element.querySelector('.peyuZ span');
            const messageElement = element.querySelector('.KR99L span');

            if (!usernameElement || !messageElement) {
                return;
            }

            const username = usernameElement.innerText;
            const message = messageElement.innerText;

            if (CONFIG.IGNORED_PHRASES.some(phrase => message.includes(phrase))) {
                return;
            }

            if (CONFIG.GIFTER_MODE && !giftSenders.has(username)) {
                return;
            }

            const fullMessage = `${username}: ${message}`;
            if (!readMessagesSet.has(fullMessage)) {
                readMessagesSet.add(fullMessage);
                speak(message, username);
            }
        }
    }

    // ==================== GESTIÓN DE CONFIGURACIÓN ====================

    function loadConfig() {
        chrome.storage.sync.get([
            'selectedVoice',
            'coinRanges',
            'coinMessages',
            'giftAudios',
            'gifterMode',
            'speechRate',
            'speechVolume',
            'speechPitch'
        ], (result) => {
            if (result.selectedVoice) {
                CONFIG.SELECTED_VOICE = result.selectedVoice;
            }
            if (result.coinRanges) {
                for (const key in result.coinRanges) {
                    if (result.coinRanges[key][1] === null) {
                        result.coinRanges[key][1] = Infinity;
                    }
                }
                Object.assign(CONFIG.COIN_RANGES, result.coinRanges);
            }
            if (result.coinMessages) {
                Object.assign(CONFIG.COIN_MESSAGES, result.coinMessages);
            }
            if (result.giftAudios) {
                Object.assign(CONFIG.GIFT_AUDIOS, result.giftAudios);
            }
            if (result.gifterMode !== undefined) {
                CONFIG.GIFTER_MODE = result.gifterMode;
            }
            if (result.speechRate !== undefined) {
                CONFIG.SPEECH_RATE = result.speechRate;
            }
            if (result.speechVolume !== undefined) {
                CONFIG.SPEECH_VOLUME = result.speechVolume;
            }
            if (result.speechPitch !== undefined) {
                CONFIG.SPEECH_PITCH = result.speechPitch;
            }
            console.log('SpeakChat: Configuración cargada:', CONFIG);
        });
    }

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'instantUpdate' && request.config) {
            if (request.config.selectedVoice !== undefined) {
                CONFIG.SELECTED_VOICE = request.config.selectedVoice;
            }
            if (request.config.coinRanges) {
                for (const key in request.config.coinRanges) {
                    if (request.config.coinRanges[key][1] === null) {
                        request.config.coinRanges[key][1] = Infinity;
                    }
                }
                Object.assign(CONFIG.COIN_RANGES, request.config.coinRanges);
            }
            if (request.config.coinMessages) {
                Object.assign(CONFIG.COIN_MESSAGES, request.config.coinMessages);
            }
            if (request.config.giftAudios) {
                Object.assign(CONFIG.GIFT_AUDIOS, request.config.giftAudios);
            }
            if (request.config.gifterMode !== undefined) {
                CONFIG.GIFTER_MODE = request.config.gifterMode;
            }
            if (request.config.speechRate !== undefined) {
                CONFIG.SPEECH_RATE = request.config.speechRate;
            }
            if (request.config.speechVolume !== undefined) {
                CONFIG.SPEECH_VOLUME = request.config.speechVolume;
            }
            if (request.config.speechPitch !== undefined) {
                CONFIG.SPEECH_PITCH = request.config.speechPitch;
            }
            console.log('SpeakChat: Configuración actualizada instantáneamente:', CONFIG);
        }
    });

    // ==================== OBSERVADOR DEL DOM ====================

    /**
     * Inicializa el MutationObserver para detectar nuevos mensajes en el chat de Tango.me.
     */
    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!mutation.addedNodes.length) return;

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    // El cambio clave está aquí: buscamos el contenedor J_XGe,
                    // que es más estable que los contenedores externos.
                    if (node.matches('.J_XGe')) {
                        processChatEvent(node);
                    } else {
                        // Si el nodo añadido es un contenedor más grande, buscamos los elementos de chat/regalo dentro de él.
                        const potentialElements = node.querySelectorAll('.J_XGe');
                        potentialElements.forEach(el => {
                            processChatEvent(el);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== INICIALIZACIÓN DE VOCES ====================

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

    // ==================== FUNCIÓN DE INICIO GLOBAL ====================

    (async function init() {
        await initVoices();
        loadConfig();
        initObserver();
        setInterval(loadConfig, 5000);
    })();

    window.speechSynthesis.getVoices();
})();