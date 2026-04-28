const voiceSelect = document.getElementById('voice');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');

const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');

const testBtn = document.getElementById('testVoice');
const toggleBtn = document.getElementById('toggle');
const openOptionsBtn = document.getElementById('openOptions');

// 🎤 cargar voces
function loadVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    voices.forEach((voice, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = voice.name;
        voiceSelect.appendChild(option);
    });
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// 💾 guardar config
function saveSettings() {
    chrome.storage.sync.set({
        voice: voiceSelect.value,
        rate: rateInput.value,
        pitch: pitchInput.value
    });
}

// 📥 cargar config
function loadSettings() {
    chrome.storage.sync.get(['voice', 'rate', 'pitch', 'enabled'], (data) => {

        if (data.voice !== undefined) voiceSelect.value = data.voice;
        if (data.rate !== undefined) rateInput.value = data.rate;
        if (data.pitch !== undefined) pitchInput.value = data.pitch;

        rateValue.textContent = rateInput.value;
        pitchValue.textContent = pitchInput.value;

        updateToggle(data.enabled !== false); // default ON
    });
}

// ▶️ PROBAR VOZ
testBtn.addEventListener('click', () => {

    const voices = speechSynthesis.getVoices();
    const utter = new SpeechSynthesisUtterance("Esta es una prueba de voz");

    const selectedVoice = voices[voiceSelect.value];
    if (selectedVoice) utter.voice = selectedVoice;

    utter.rate = parseFloat(rateInput.value);
    utter.pitch = parseFloat(pitchInput.value);

    speechSynthesis.speak(utter);
});

// ⏻ TOGGLE
function updateToggle(enabled) {
    toggleBtn.textContent = enabled ? '⏻ Activado' : '⏻ Desactivado';
    toggleBtn.style.background = enabled ? '#2a7' : '#722';
}

toggleBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['enabled'], (data) => {
        const newState = !(data.enabled !== false);
        chrome.storage.sync.set({ enabled: newState });
        updateToggle(newState);
    });
});

// ⚙️ abrir opciones
openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// 🎛️ eventos
voiceSelect.addEventListener('change', saveSettings);

rateInput.addEventListener('input', () => {
    rateValue.textContent = rateInput.value;
    saveSettings();
});

pitchInput.addEventListener('input', () => {
    pitchValue.textContent = pitchInput.value;
    saveSettings();
});

// init
loadSettings();