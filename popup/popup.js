document.addEventListener('DOMContentLoaded', () => {
    // Elementos UI
    const voiceSelect = document.getElementById('voiceSelect');
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    const saveBtn = document.getElementById('saveBtn');
    const statusEl = document.getElementById('status');
    const themeToggle = document.getElementById('themeToggle');
    const testAudioBtns = document.querySelectorAll('.btn-audio-test');

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
        "audio0.mp3",
        "audio1.mp3",
        "audio2.mp3",
        "audio3.mp3",
        "audio4.mp3"
    ];

    // ========== FUNCIONES PRINCIPALES ========== //

    // Controlador de tema oscuro/claro
    function initTheme() {
        // Verificar preferencia del sistema
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Cargar configuración guardada o usar preferencia del sistema
        chrome.storage.sync.get(['darkMode'], (result) => {
            const darkMode = result.darkMode !== undefined ? result.darkMode : systemPrefersDark;
            setTheme(darkMode);
        });

        // Escuchar cambios en el toggle
        themeToggle.addEventListener('change', () => {
            const isDark = themeToggle.checked;
            setTheme(isDark);
            chrome.storage.sync.set({ darkMode: isDark });
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
        
        // Ordenar voces alfabéticamente
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
                    `<option value="${audio}">${audio}</option>`
                ).join('');
        });

        // Cargar configuración guardada
        loadSavedConfig();
    }

    // Cargar configuración desde chrome.storage
    function loadSavedConfig() {
        chrome.storage.sync.get([
            'selectedVoice', 
            'coinRanges', 
            'coinMessages', 
            'giftAudios',
            'darkMode'
        ], (result) => {
            // Configuración de voz
            if (result.selectedVoice) {
                voiceSelect.value = result.selectedVoice;
            }
            
            // Rangos de monedas
            if (result.coinRanges) {
                Object.entries(result.coinRanges).forEach(([key, range]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index]) {
                        rangeConfigs[index].min.value = range[0];
                        rangeConfigs[index].max.value = range[1] === Infinity ? '' : range[1];
                    }
                });
            }

            // Mensajes personalizados
            if (result.coinMessages) {
                Object.entries(result.coinMessages).forEach(([key, message]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index]) {
                        rangeConfigs[index].msg.value = message;
                    }
                });
            }

            // Audios de regalos
            if (result.giftAudios) {
                Object.entries(result.giftAudios).forEach(([key, audio]) => {
                    const index = parseInt(key) - 1;
                    if (rangeConfigs[index] && audio) {
                        rangeConfigs[index].audio.value = audio;
                    }
                });
            }

            // Tema oscuro
            if (result.darkMode !== undefined) {
                setTheme(result.darkMode);
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
                window.speechSynthesis.speak(utterance);
            } else {
                showStatus('Selecciona una voz primero', true);
            }
        });
    }

    // Guardar configuración
    function setupSaveButton() {
        saveBtn.addEventListener('click', () => {
            const config = {
                selectedVoice: voiceSelect.value,
                coinRanges: {
                    1: [parseInt(rangeConfigs[0].min.value), parseInt(rangeConfigs[0].max.value || 'Infinity')],
                    2: [parseInt(rangeConfigs[1].min.value), parseInt(rangeConfigs[1].max.value || 'Infinity')],
                    3: [parseInt(rangeConfigs[2].min.value), parseInt(rangeConfigs[2].max.value || 'Infinity')]
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
                darkMode: themeToggle.checked
            };

            chrome.storage.sync.set(config, () => {
                showStatus('Configuración guardada');
                
                // Enviar cambios al content script
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'instantUpdate',
                            config: config
                        });
                    }
                });
            });
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
        loadVoices();
        setupAudioTestButtons();
        setupVoiceTestButton();
        setupSaveButton();
        
        // Forzar carga inicial de voces
        window.speechSynthesis.onvoiceschanged = loadVoices;
        if (window.speechSynthesis.getVoices().length > 0) {
            loadVoices();
        }
    }

    init();
});