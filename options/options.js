// options.js

let saveTimeout = null;

// 🚀 INIT
document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('ranges');

    // 🎨 crear 6 rangos
    for (let i = 1; i <= 6; i++) {

        const div = document.createElement('div');
        div.className = 'range-card';

        div.innerHTML = `
            <h4>Rango ${i}</h4>

            <input type="number" id="min${i}" placeholder="Min">
            <input type="number" id="max${i}" placeholder="Max">

           <select id="audio${i}">
           <option value="none">No Audio</option>
           ${Array.from({ length: 10 }, (_, j) =>
          `<option value="audio${j + 1}.mp3">Audio ${j + 1}</option>`
           ).join('')}
           </select>

            <input type="text" id="msg${i}" placeholder="Mensaje ({user} {coins})">

            <button class="test-btn" data-index="${i}">
                ▶️ Probar
            </button>
        `;

        container.appendChild(div);
    }

    // 📥 cargar datos
    loadSettings();

    // ▶️ probar audio
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('test-btn')) {
            testRange(e.target.dataset.index);
        }
    });

    // 🔥 AUTO GUARDADO
    document.addEventListener('input', triggerAutoSave);
    document.addEventListener('change', triggerAutoSave);
});


// ⏱️ debounce guardado
function triggerAutoSave() {

    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(() => {
        saveSettings();
    }, 600); // guarda después de dejar de escribir
}


// 💾 guardar
function saveSettings() {

    const ranges = [];

    for (let i = 1; i <= 6; i++) {

        const min = document.getElementById(`min${i}`).value;
        const max = document.getElementById(`max${i}`).value;
        const audio = document.getElementById(`audio${i}`).value;
        const message = document.getElementById(`msg${i}`).value;

        if (!min || !max) continue;

        ranges.push({
            min: parseInt(min),
            max: parseInt(max),
            audio: audio,
            message: message
        });
    }

    const gifterMode = document.getElementById('gifterMode').checked;

    const blacklistText = document.getElementById('blacklist').value;

    const blacklist = blacklistText
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

    chrome.storage.sync.set({
        giftSounds: ranges,
        gifterMode: gifterMode,
        blacklist: blacklist
    }, () => {
        showSavedMessage();
    });
}


// 📥 cargar
function loadSettings() {

    chrome.storage.sync.get(['giftSounds', 'gifterMode', 'blacklist'], (data) => {

        if (data.giftSounds) {
            data.giftSounds.forEach((r, i) => {

                const index = i + 1;

                if (!document.getElementById(`min${index}`)) return;

                document.getElementById(`min${index}`).value = r.min || '';
                document.getElementById(`max${index}`).value = r.max || '';
                document.getElementById(`audio${index}`).value = r.audio || 'audio1.mp3';
                document.getElementById(`msg${index}`).value = r.message || '';
            });
        }

        document.getElementById('gifterMode').checked = data.gifterMode || false;

        if (data.blacklist) {
            document.getElementById('blacklist').value = data.blacklist.join('\n');
        }
    });
}


// ✅ mensaje guardado
function showSavedMessage() {

    const el = document.getElementById('saveStatus');

    el.style.opacity = '1';

    setTimeout(() => {
        el.style.opacity = '0';
    }, 2000);
}


// ▶️ probar audio
function testRange(i) {

    const audioFile = document.getElementById(`audio${i}`).value;

    if (!audioFile) return;

    const path = chrome.runtime.getURL(`audios/${audioFile}`);
    const audio = new Audio(path);

    audio.volume = 1;
    audio.play();
}