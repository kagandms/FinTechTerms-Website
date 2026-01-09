// ============================================
// GlobalFinTerm - Text-to-Speech Utilities
// ============================================

type SupportedLanguage = 'tr' | 'en' | 'ru';

/**
 * Language codes for Web Speech API
 */
const SPEECH_LANG_CODES: Record<SupportedLanguage, string> = {
    en: 'en-US',
    ru: 'ru-RU',
    tr: 'tr-TR',
};

/**
 * Check if speech synthesis is available
 */
export function isSpeechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak text in the specified language
 * 
 * @param text - Text to speak
 * @param language - Language code
 * @returns Promise that resolves when speech ends
 */
export function speakText(text: string, language: SupportedLanguage): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!isSpeechAvailable()) {
            reject(new Error('Speech synthesis not available'));
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = SPEECH_LANG_CODES[language];
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find a voice for the language
        const voices = window.speechSynthesis.getVoices();
        const langCode = SPEECH_LANG_CODES[language];
        const voice = voices.find(v => v.lang.startsWith(langCode.split('-')[0] ?? langCode));

        if (voice) {
            utterance.voice = voice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(event.error);

        window.speechSynthesis.speak(utterance);
    });
}

/**
 * Get available voices for a language
 */
export function getVoicesForLanguage(language: SupportedLanguage): SpeechSynthesisVoice[] {
    if (!isSpeechAvailable()) return [];

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = SPEECH_LANG_CODES[language].split('-')[0] ?? language;

    return voices.filter(v => v.lang.startsWith(langPrefix));
}

/**
 * Stop any ongoing speech
 */
export function stopSpeech(): void {
    if (isSpeechAvailable()) {
        window.speechSynthesis.cancel();
    }
}
