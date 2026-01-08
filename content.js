// content.js
// Este script se inyecta en la página tango.me para interactuar con el DOM y procesar mensajes/regalos.
// ==UserScript==
// @name         TNG SpeakChat
// @description  Reproduce mensajes y regalos con voz personalizable y efectos de audio, para la pagina tango.me
// @author       Jimmy - Microondas Creativos
// @match        https://tango.me/*
// @grant        none
// @version      3.2.0 // Versión adaptada para cubrir cambios de HTML
// ==/UserScript==

(function() {
    'use strict';

    let CONFIG = {
        ENABLE_COIN_MESSAGES: true,
        SELECTED_VOICE: null,
        GIFTER_MODE: false,
        IGNORED_PHRASES: ['empezó a ver', 'entró a la sala', 'salió de la sala'],
        // NUEVA CONFIGURACIÓN: Lista de usuarios a ignorar (añade aquí los que desees)
        IGNORED_USERS: ['Tango Happy Hour','Battle Results', 'Top Gifter'], 
        AUDIO_BASE_URL: chrome.runtime.getURL('audios/'),
        COIN_RANGES: {
            1: [1, 500],
            2: [501, 1000],
            3: [1001, 2000],
			4: [2001, 5000],
            5: [5001, 10000],
            6: [10001, Infinity]
        },
        COIN_MESSAGES: {
            1: '¡Qué generosidad!',
            2: '¡Impresionante regalo!',
            3: '¡Espectacular regalo!',
			4: '¡Qué generosidad!',
            5: '¡Impresionante regalo!',
            6: '¡Espectacular regalo!'
        },
        GIFT_AUDIOS: {
            1: null,
            2: null,
            3: null,
			4: null,
            5: null,
            6: null
        },
        SPEECH_RATE: 1.0,
        SPEECH_VOLUME: 1.0,
        SPEECH_PITCH: 1.0
    };

    const giftSenders = new Set();
    let lastSpokenUser = null;

    function cleanText(text) {
        if (!text) return '';
        // Esta línea elimina emojis y símbolos especiales
        return text.replace(/\p{Emoji}/gu, '').trim();
    }

    // Ahora devuelve una Promise que se resuelve al terminar el audio
    function playGiftAudio(audioFile) {
        if (!audioFile) return Promise.resolve(); // Si no hay audio, resuelve inmediatamente

        return new Promise((resolve) => {
            const audio = new Audio(CONFIG.AUDIO_BASE_URL + audioFile);
            
            // Resuelve la promesa cuando el audio termine
            audio.onended = () => {
                resolve();
            };

            // En caso de error, también resolvemos para no bloquear el proceso de voz
            audio.onerror = (e) => {
                console.error("SpeakChat: Error al reproducir audio:", e);
                speak("Error al reproducir efecto de audio");
                resolve();
            };

            audio.play().catch(e => {
                console.error("SpeakChat: Error al iniciar la reproducción de audio:", e);
                speak("Error al reproducir efecto de audio");
                resolve();
            });
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
        utterance.rate = CONFIG.SPEECH_RATE;
        utterance.volume = CONFIG.SPEECH_VOLUME;
        utterance.pitch = CONFIG.SPEECH_PITCH;

        window.speechSynthesis.speak(utterance);
        lastSpokenUser = currentUser;
    }

    // Ahora es una función asíncrona (async)
    async function processChatEvent(element) {
        // Intentar encontrar precio de regalo con múltiples selectores
        const giftPriceElement = 
            element.querySelector('[data-testid="gift-price-coins-number"]') ||
            element.querySelector('[class*="coins-number"]') ||
            element.querySelector('span:has(svg[aria-label*="coins"])');

        // Sección de Regalos: NO se ve afectada por IGNORED_USERS
        if (giftPriceElement) {
            if (!CONFIG.ENABLE_COIN_MESSAGES) return;

            const usernameElement =
                element.querySelector('.peyuZ span') ||
                element.querySelector('[class*="username"] span') ||
                element.querySelector('span[class*="user"]');

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

            // Usar await para esperar la finalización del audio
            if (audioFile) await playGiftAudio(audioFile); 
            
            speak(giftMessage);
            
        } 
        // Sección de Mensajes de Texto
        else {
            const usernameElement =
                element.querySelector('.peyuZ span') ||
                element.querySelector('[class*="username"] span');

            const messageElement =
                element.querySelector('.KR99L span') ||
                element.querySelector('[class*="message"] span');

            if (!usernameElement || !messageElement) return;

            const username = cleanText(usernameElement.innerText, true); // Asegurar el nombre limpio para la comparación
            const message = cleanText(messageElement.innerText);

            if (CONFIG.IGNORED_PHRASES.some(phrase => message.includes(phrase))) return;
            if (CONFIG.GIFTER_MODE && !giftSenders.has(username)) return;

            // NUEVA COMPROBACIÓN: Ignorar si el usuario está en la lista
            if (CONFIG.IGNORED_USERS.includes(username)) return;

            speak(message, username);
        }
    }

    function loadConfig() {
        chrome.storage.sync.get([
            'selectedVoice', 'coinRanges', 'coinMessages', 'giftAudios',
            'gifterMode', 'speechRate', 'speechVolume', 'speechPitch'
        ], (result) => {
            if (result.selectedVoice) CONFIG.SELECTED_VOICE = result.selectedVoice;
            if (result.coinRanges) {
                for (const key in result.coinRanges) {
                    if (result.coinRanges[key][1] === null) result.coinRanges[key][1] = Infinity;
                }
                Object.assign(CONFIG.COIN_RANGES, result.coinRanges);
            }
            if (result.coinMessages) Object.assign(CONFIG.COIN_MESSAGES, result.coinMessages);
            if (result.giftAudios) Object.assign(CONFIG.GIFT_AUDIOS, result.giftAudios);
            if (result.gifterMode !== undefined) CONFIG.GIFTER_MODE = result.gifterMode;
            if (result.speechRate !== undefined) CONFIG.SPEECH_RATE = result.speechRate;
            if (result.speechVolume !== undefined) CONFIG.SPEECH_VOLUME = result.speechVolume;
            if (result.speechPitch !== undefined) CONFIG.SPEECH_PITCH = result.speechPitch;
        });
    }

    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!mutation.addedNodes.length) return;

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    const isChatElement = 
                        node.matches('.J_XGe') ||
                        node.querySelector('[data-testid="gift-price-coins-number"]') ||
                        node.querySelector('[class*="coins-number"]');
                    
                    if (isChatElement) {
                        processChatEvent(node);
                    } else {
                        const potentialElements = node.querySelectorAll(
                            '.J_XGe, [data-testid="gift-price-coins-number"], [class*="coins-number"]'
                        );
                        potentialElements.forEach(el => processChatEvent(el));
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

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
        setInterval(loadConfig, 5000);
    })();

})();