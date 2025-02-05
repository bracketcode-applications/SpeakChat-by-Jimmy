// ==UserScript==
// @name         SpeechChat para Tango.me (Con Voz de Microsoft)
// @namespace    http://tampermonkey.net/
// @version      0.31
// @description  Captura mensajes del chat con nombre de usuario y los envía al servidor, incluyendo notificaciones de regalos
// @author       JimmyMicroondas
// @match        https://tango.me/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const readMessagesSet = new Set(); // Set para guardar los mensajes ya leídos
    const enableCoinMessages = true; // Cambia esto a false para desactivar los mensajes adicionales según la cantidad de monedas
    let lastUsername = ''; // Almacena el nombre del último usuario leído
    let messageCount = 0; // Contador de mensajes consecutivos del mismo usuario
    let selectedVoiceName = ''; // Almacenar el nombre de la voz seleccionada
    let coinRanges = []; // Almacenar los rangos de monedas
    let giftMessages = []; // Almacenar los mensajes de regalo

    // Cargar configuración de la voz seleccionada y los mensajes
    chrome.storage.sync.get(['selectedVoice', 'coinRanges', 'giftMessages'], (data) => {
        selectedVoiceName = data.selectedVoice || 'Microsoft Helena - Spanish (Spain)';
        coinRanges = data.coinRanges || [
            { min: 1000, max: 5000 },
            { min: 5001, max: 10000 },
            { min: 10001, max: Infinity }
        ];
        giftMessages = data.giftMessages || ['¡Qué generosidad!', '¡Impresionante regalo!', '¡Espectacular regalo!'];
    });

    // Escuchar mensajes para actualizar la configuración
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateSettings') {
            selectedVoiceName = request.selectedVoice;
            coinRanges = request.coinRanges;
            giftMessages = request.giftMessages;
        }
    });

    // Función para eliminar emojis de una cadena de texto
    function removeEmojis(text) {
        return text.replace(/[\p{Emoji}]/gu, '');
    }

    // Función para leer los mensajes en voz alta
    function readMessagesAloud(text) {
        const synth = window.speechSynthesis;

        function selectVoiceAndSpeak() {
            let voices = synth.getVoices();
            let selectedVoice = voices.find(voice => voice.name === selectedVoiceName);
            if (!selectedVoice) {
                console.error(`No hay voces disponibles con el nombre: ${selectedVoiceName}`);
                voices.forEach(voice => {
                    console.log(`Voz disponible: ${voice.name} (${voice.lang})`);
                });
                return;
            }
            const utterThis = new SpeechSynthesisUtterance(text);
            utterThis.voice = selectedVoice;
            synth.speak(utterThis);
        }

        if (synth.getVoices().length) {
            selectVoiceAndSpeak();
        } else {
            synth.onvoiceschanged = () => {
                selectVoiceAndSpeak();
            };
        }
    }

    // Guardar mensaje en localStorage
    function saveMessageLocally(message) {
        let messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
        messages.push(message);
        localStorage.setItem('chatMessages', JSON.stringify(messages));
        readMessagesAloud(message); // Leer mensaje en voz alta en el momento
    }

    // Función para leer los mensajes agrupados de un usuario en voz alta
    function readGroupedMessages(username, messages) {
        const groupedMessage = messages.join(' ');
        if (messageCount === 0) {
            saveMessageLocally(`${username}: ${groupedMessage}`); // Guardar y leer en voz alta el primer mensaje con el nombre del usuario
            messageCount = 1; // Incrementar el contador de mensajes consecutivos
        } else {
            if (messageCount < 15) {
                saveMessageLocally(groupedMessage); // Guardar y leer en voz alta el mensaje agrupado sin repetir el nombre del usuario
                messageCount++;
            } else {
                saveMessageLocally(`${username}: ${groupedMessage}`); // Guardar y leer en voz alta el mensaje con el nombre del usuario después de 5 mensajes
                messageCount = 1; // Reiniciar el contador de mensajes consecutivos
            }
        }
        lastUsername = username; // Actualizar el último usuario leído
    }

    // Función para obtener el texto de los mensajes del chat y guardarlos localmente
    function getChatMessages() {
        const chatElements = document.querySelectorAll('.Wuuru .J_XGe'); // Selecciona los elementos de chat
        console.log('chatElements:', chatElements); // Log para verificar los elementos seleccionados
        if (chatElements.length > 0) {
            chatElements.forEach(element => {
                const usernameSpan = element.querySelector('.peyuZ span'); // Selecciona el span del nombre de usuario
                const messageSpan = element.querySelector('.KR99L span'); // Selecciona el span del mensaje
                console.log('usernameSpan:', usernameSpan); // Log para verificar el elemento del nombre de usuario
                console.log('messageSpan:', messageSpan); // Log para verificar el elemento del mensaje
                if (usernameSpan && messageSpan) {
                    let username = usernameSpan.innerText; // Obtiene el nombre del usuario
                    const message = messageSpan.innerText; // Obtiene el mensaje

                    // Ignorar mensajes que contienen "empezó a ver"
                    if (message.includes('empezó a ver')) {
                        console.log('Mensaje ignorado:', message);
                        return;
                    }

                    // Eliminar emojis del nombre del usuario
                    username = removeEmojis(username);

                    const fullMessage = `${username}: ${message}`;
                    if (!readMessagesSet.has(fullMessage)) {
                        // Verificar si el mensaje ya ha sido leído
                        readMessagesSet.add(fullMessage); // Añadir el mensaje al Set
                        console.log('Mensaje capturado:', fullMessage); // Log para verificar captura de mensaje
                        if (username === lastUsername) {
                            readGroupedMessages(username, [message]); // Leer mensaje con la lógica de omitir el nombre del usuario
                        } else {
                            lastUsername = username; // Actualizar el último usuario leído
                            messageCount = 0; // Reiniciar el contador de mensajes consecutivos
                            readGroupedMessages(username, [message]); // Leer mensaje con el nombre del usuario
                        }
                    }
                } else {
                    console.error('No se encontraron los spans necesarios');
                }
            });
        } else {
            console.error('Elementos de chat no encontrados');
        }
    }

    // Función para obtener el texto de los regalos y leerlos en voz alta
    function getGiftMessages() {
        const giftElements = document.querySelectorAll('.J_XGe .KR99L'); // Ajusta el selector a los elementos de regalo
        console.log('giftElements length:', giftElements.length);
        if (giftElements.length > 0) {
            giftElements.forEach(element => {
                const usernameElement = element.closest('.J_XGe').querySelector('.peyuZ span'); // Ajusta el selector al nombre de usuario
                const priceElement = element.querySelector('.FJnYG');
                if (usernameElement && priceElement) {
                    const username = removeEmojis(usernameElement.innerText); // Eliminar emojis del nombre de usuario
                    const price = parseInt(priceElement.innerHTML.split('</svg>')[1].trim(), 10);
                    let message = '';

                    if (enableCoinMessages) {
                        for (let i = 0; i < coinRanges.length; i++) {
                            if (price >= coinRanges[i].min && price <= coinRanges[i].max) {
                                message = giftMessages[i];
                                break;
                            }
                        }
                    }

                    const giftMessage = `${username} ha enviado ${price} monedas. ${message}. Muchas gracias por tu regalo.`;
                    if (!readMessagesSet.has(giftMessage)) {
                        readMessagesSet.add(giftMessage);
                        console.log('Mensaje de regalo capturado:', giftMessage);
                        readMessagesAloud(giftMessage);
                    }
                } else {
                    console.error('No se encontraron los elementos necesarios para los regalos');
                }
            });
        } else {
            console.error('Elementos de regalos no encontrados');
        }
    }

    setInterval(getChatMessages, 500); // Cada menos de un segundo
    setInterval(getGiftMessages, 500); // Cada menos de un segundo para captar mensajes de regalos
})();
