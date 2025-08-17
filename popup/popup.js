// popup.js
// Este archivo JavaScript maneja la lógica cuando el usuario interactúa con el popup de la extensión.
document.addEventListener('DOMContentLoaded', () => {
    // Elementos UI
    const voiceSelect = document.getElementById('voiceSelect');
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    const statusEl = document.getElementById('status');
    const themeToggle = document.getElementById('themeToggle');
    const gifterModeToggle = document.getElementById('gifterModeToggle');
    const testAudioBtns = document.querySelectorAll('.btn-audio-test');

    // Nuevos elementos para los sliders de voz
    const rateSlider = document.getElementById('rateSlider');
    const rateValueSpan = document.getElementById('rateValue');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValueSpan = document.getElementById('volumeValue');
    const pitchSlider = document.getElementById('pitchSlider');
    const pitchValueSpan = document.getElementById('pitchValue');

    // Configuración de rangos
    const rangeConfigs = [
        {
            min: document.getElementById('rangeMin1'),
            max: document.getElementById('rangeMax1'),
            msg: document.getElementById('message1'),
            audio: document.getElementById('audioSelect1')
        },
        {
            min: document.getElementById('rangeMin2'),
            max: document.getElementById('rangeMax2'),
            msg: document.getElementById('message2'),
            audio: document.getElementById('audioSelect2')
        },
        {
            min: document.getElementById('rangeMin3'),
            max: document.getElementById('rangeMax3'),
            msg: document.getElementById('message3'),
            audio: document.getElementById('audioSelect3')
        }
    ];

    // Audios disponibles
    const AUDIO_FILES = [
        { file: "audio0.mp3", name: "Clip 1" },
        { file: "audio1.mp3", name: "Clip 2" },
        { file: "audio2.mp3", name: "Clip 3" },
        { file: "audio3.mp3", name: "Clip 4" },
        { file: "audio4.mp3", name: "Clip 5" }
    ];

    // ========== FUNCIONES PRINCIPALES ========== //

    // Controlador de tema oscuro/claro
    function initTheme() {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        chrome.storage.sync.get(['darkMode'], (result) => {
            const darkMode = result.darkMode !== undefined ? result.darkMode : systemPrefersDark;
            setTheme(darkMode);
        });

        themeToggle.addEventListener('change', () => {
            const isDark = themeToggle.checked;
            setTheme(isDark);
            saveConfig();
        });
    }

    function setTheme(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        themeToggle.checked = isDark;
    }

    // Cargar voces y configuración
    function loadVoices() {
        const voices = window.speechSynthesis.getVoices();
        voiceSelect.innerHTML = '<option value="">Seleccionar voz...</option>';

        voices.sort((a, b) => a.name.localeCompare(b.name)).forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });

        // Llenar selectores de audio
        rangeConfigs.forEach(config => {
            config.audio.innerHTML = '<option value="">Ninguno</option>' +
                AUDIO_FILES.map(audio =>
                    `<option value="${audio.file}">${audio.name}</option>`
                ).join('');
        });

        loadSavedConfig();
    }

    // Cargar configuración guardada
    function loadSavedConfig() {
        chrome.storage.sync.get([
            'selectedVoice',
            'coinRanges',
            'coinMessages',
            'giftAudios',
            'darkMode',
            'gifterMode',
            'speechRate', // Nuevo
            'speechVolume', // Nuevo
            'speechPitch' // Nuevo
        ], (result) => {
            console.log('Popup: Valores recibidos de storage.sync.get:', result); // DEBUG

            if (result.selectedVoice) {
                voiceSelect.value = result.selectedVoice;
            }

            if (result.coinRanges) {
                Object.entries(result.coinRanges).forEach(([key, range]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index]) {
                        rangeConfigs[index].min.value = range[0];
                        rangeConfigs[index].max.value = range[1] === Infinity ? '' : range[1];
                    }
                });
            }

            if (result.coinMessages) {
                Object.entries(result.coinMessages).forEach(([key, message]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index]) {
                        rangeConfigs[index].msg.value = message;
                    }
                });
            }

            if (result.giftAudios) {
                Object.entries(result.giftAudios).forEach(([key, audio]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index] && audio) {
                        rangeConfigs[index].audio.value = audio;
                    }
                });
            }

            if (result.darkMode !== undefined) {
                setTheme(result.darkMode);
            }

            if (result.gifterMode !== undefined) {
                gifterModeToggle.checked = result.gifterMode;
            }

            // Cargar valores de sliders, si existen, o usar valores por defecto
            // Asegurarse de que los valores sean números válidos antes de asignarlos
            rateSlider.value = result.speechRate !== undefined ? parseFloat(result.speechRate) : 1.0;
            rateValueSpan.textContent = rateSlider.value;
            console.log('Popup: rateSlider.value después de cargar:', rateSlider.value); // DEBUG

            volumeSlider.value = result.speechVolume !== undefined ? parseFloat(result.speechVolume) : 1.0;
            volumeValueSpan.textContent = volumeSlider.value;
            console.log('Popup: volumeSlider.value después de cargar:', volumeSlider.value); // DEBUG

            pitchSlider.value = result.speechPitch !== undefined ? parseFloat(result.speechPitch) : 1.0;
            pitchValueSpan.textContent = pitchSlider.value;
            console.log('Popup: pitchSlider.value después de cargar:', pitchSlider.value); // DEBUG
        });
    }

    // Configurar guardado automático
    function setupAutoSave() {
        // Elementos que activarán el guardado
        const autoSaveElements = [
            voiceSelect,
            themeToggle,
            gifterModeToggle,
            rateSlider, // Nuevo
            volumeSlider, // Nuevo
            pitchSlider, // Nuevo
            ...rangeConfigs.flatMap(config => [config.min, config.max, config.msg, config.audio])
        ];

        autoSaveElements.forEach(element => {
            element.addEventListener('change', debounce(saveConfig, 500));
            // Actualizar valor mostrado al mover el slider
            if (element.type === 'range') {
                element.addEventListener('input', (event) => {
                    if (event.target.id === 'rateSlider') {
                        rateValueSpan.textContent = event.target.value;
                    } else if (event.target.id === 'volumeSlider') {
                        volumeValueSpan.textContent = event.target.value;
                    } else if (event.target.id === 'pitchSlider') {
                        pitchValueSpan.textContent = event.target.value;
                    }
                });
            }
        });
    }

    // Función debounce para evitar múltiples llamadas
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    // Guardar configuración
    function saveConfig() {
        const config = {
            selectedVoice: voiceSelect.value,
            coinRanges: {
                1: [parseInt(rangeConfigs[0].min.value) || 0, parseInt(rangeConfigs[0].max.value || 'Infinity')],
                2: [parseInt(rangeConfigs[1].min.value) || 0, parseInt(rangeConfigs[1].max.value || 'Infinity')],
                3: [parseInt(rangeConfigs[2].min.value) || 0, parseInt(rangeConfigs[2].max.value || 'Infinity')]
            },
            coinMessages: {
                1: rangeConfigs[0].msg.value.trim(),
                2: rangeConfigs[1].msg.value.trim(),
                3: rangeConfigs[2].msg.value.trim()
            },
            giftAudios: {
                1: rangeConfigs[0].audio.value || null,
                2: rangeConfigs[1].audio.value || null,
                3: rangeConfigs[2].audio.value || null
            },
            darkMode: themeToggle.checked,
            gifterMode: gifterModeToggle.checked,
            speechRate: parseFloat(rateSlider.value), // Nuevo
            speechVolume: parseFloat(volumeSlider.value), // Nuevo
            speechPitch: parseFloat(pitchSlider.value) // Nuevo
        };

        console.log('Popup: Guardando configuración:', config); // DEBUG

        chrome.storage.sync.set(config, () => {
            if (chrome.runtime.lastError) {
                console.error('Popup: Error al guardar configuración:', chrome.runtime.lastError); // DEBUG
                showStatus('Error al guardar configuración', true);
            } else {
                console.log('Popup: Configuración guardada exitosamente.'); // DEBUG
                showStatus('Configuración guardada automáticamente');

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'instantUpdate',
                            config: config
                        });
                    }
                });
            }
        });
    }

    // Probar audio seleccionado
    function setupAudioTestButtons() {
        testAudioBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const audioSelectId = btn.getAttribute('data-audio-select');
                const audioSelect = document.getElementById(audioSelectId);
                const audioFile = audioSelect.value;

                if (!audioFile) {
                    showStatus('Selecciona un audio primero');
                    return;
                }

                const audio = new Audio(chrome.runtime.getURL(`audios/${audioFile}`));
                audio.play().catch(e => {
                    console.error("Error al reproducir audio:", e);
                    showStatus('Error al reproducir audio', true);
                });
            });
        });
    }

    // Probar voz seleccionada
    function setupVoiceTestButton() {
        testVoiceBtn.addEventListener('click', () => {
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === voiceSelect.value);

            if (selectedVoice) {
                const utterance = new SpeechSynthesisUtterance("Prueba de voz exitosa");
                utterance.voice = selectedVoice;
                utterance.rate = parseFloat(rateSlider.value); // Usar valor del slider
                utterance.volume = parseFloat(volumeSlider.value); // Usar valor del slider
                utterance.pitch = parseFloat(pitchSlider.value); // Usar valor del slider

                console.log('Popup: Probando voz con:', {
                    voice: selectedVoice.name,
                    rate: utterance.rate,
                    volume: utterance.volume,
                    pitch: utterance.pitch
                }); // DEBUG

                window.speechSynthesis.speak(utterance);
            } else {
                showStatus('Selecciona una voz primero', true);
            }
        });
    }

    // Mostrar mensaje de estado
    function showStatus(message, isError = false) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#ff0452' : '#4CAF50';
        setTimeout(() => statusEl.textContent = '', 3000);
    }

    // ========== INICIALIZACIÓN ========== //
    function init() {
        initTheme();
        loadVoices(); // loadVoices llama a loadSavedConfig
        setupAutoSave();
        setupAudioTestButtons();
        setupVoiceTestButton();

        // Este listener asegura que las voces se carguen si cambian después de la carga inicial de la página
        window.speechSynthesis.onvoiceschanged = loadVoices;
        // Si las voces ya están disponibles al cargar, asegúrate de llamarlas
        if (window.speechSynthesis.getVoices().length > 0) {
            loadVoices();
        }
    }

    init();
});
