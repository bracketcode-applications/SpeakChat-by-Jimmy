document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voiceSelect');
    const saveBtn = document.getElementById('saveBtn');

    function populateVoiceList() {
        const synth = window.speechSynthesis;
        const voices = synth.getVoices();
        
        if (voices.length === 0) {
            synth.onvoiceschanged = () => {
                populateVoiceList();
            };
            return;
        }

        voiceSelect.innerHTML = '';
        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });

        chrome.storage.sync.get(['selectedVoice', 'coinRanges', 'giftMessages'], (data) => {
            if (data.selectedVoice) {
                voiceSelect.value = data.selectedVoice;
            }
            document.getElementById('giftMessage1').value = data.giftMessages ? data.giftMessages[0] : '';
            document.getElementById('giftMessage2').value = data.giftMessages ? data.giftMessages[1] : '';
            document.getElementById('giftMessage3').value = data.giftMessages ? data.giftMessages[2] : '';
            document.getElementById('coinRange1Min').value = data.coinRanges ? data.coinRanges[0].min : '';
            document.getElementById('coinRange1Max').value = data.coinRanges ? data.coinRanges[0].max : '';
            document.getElementById('coinRange2Min').value = data.coinRanges ? data.coinRanges[1].min : '';
            document.getElementById('coinRange2Max').value = data.coinRanges ? data.coinRanges[1].max : '';
            document.getElementById('coinRange3Min').value = data.coinRanges ? data.coinRanges[2].min : '';
            document.getElementById('coinRange3Max').value = data.coinRanges ? data.coinRanges[2].max : '';
        });
    }

    function loadVoices() {
        const synth = window.speechSynthesis;
        const voices = synth.getVoices();

        if (voices.length > 0) {
            populateVoiceList();
        } else {
            synth.onvoiceschanged = populateVoiceList;
        }
    }

    loadVoices();

    saveBtn.addEventListener('click', () => {
        const selectedVoice = voiceSelect.value;
        const coinRanges = [
            { min: parseInt(document.getElementById('coinRange1Min').value, 10), max: parseInt(document.getElementById('coinRange1Max').value, 10) },
            { min: parseInt(document.getElementById('coinRange2Min').value, 10), max: parseInt(document.getElementById('coinRange2Max').value, 10) },
            { min: parseInt(document.getElementById('coinRange3Min').value, 10), max: parseInt(document.getElementById('coinRange3Max').value, 10) },
        ];
        const giftMessages = [
            document.getElementById('giftMessage1').value,
            document.getElementById('giftMessage2').value,
            document.getElementById('giftMessage3').value
        ];

        chrome.storage.sync.set({
            selectedVoice,
            coinRanges,
            giftMessages
        }, () => {
            alert('Configuración guardada.');
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "updateSettings", selectedVoice, coinRanges, giftMessages });
            });
        });
    });
});
