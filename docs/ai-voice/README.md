# Workly India AI Voice

## Current implementation

- The AI Chat composer opens `/ai-voice-call` and passes the current chat audience.
- Voice recognition uses the existing Shruti speech-recognition flow. The phone/browser TTS speaks the AI reply.
- Each recognized utterance is sent to the same `ai-career-chat` backend used by text chat. Voice therefore reuses the existing AI instructions, role context, conversation history, enabled tools and knowledge; it is not a separate assistant.
- The user's transcript and the assistant's reply are saved in the same signed-in user's AI Chat browser history. Returning to AI Chat shows both sides of the voice conversation.
- Voice replies are restricted to Hindi or English. Hindi input receives Hindi in Devanagari; English and all other languages (including Gujarati) receive English. TTS language is selected from the AI reply.
- Android call startup checks that both Hindi and English TTS voice data are available. If either is missing, Android's system TTS installer opens and the app checks again after the user returns. Android requires user confirmation; an app cannot silently install system voice data.
- No Kokoro or additional bundled TTS model is used.

## Production validation still required

1. Run the frontend production build and Android Kotlin/Gradle build.
2. Test on Android with both TTS voices installed, then with one or both missing. Confirm the installer opens and call startup resumes only after both voices are available.
3. Test Hindi, English and Gujarati speech. Confirm AI replies and spoken TTS are Hindi/English only.
4. Verify both user and AI messages appear in AI Chat history after returning from a call.
5. Verify existing AI tools run with the same permissions and confirmation requirements as text chat.
6. Test mute, interruption, call termination, offline/network errors and quota exhaustion.

## Privacy and history behavior

- Raw microphone audio and generated speech audio are not intentionally saved as call recordings.
- Recognized text and AI replies are deliberately saved in the same AI Chat history using browser local storage.
- Voice transcripts are sent to the existing AI Chat backend to generate responses and are subject to that backend's existing provider and logging configuration.
- Do not describe calls as transcript-free or no-retention: the text transcript and AI reply are retained in AI Chat history. Review provider-side logging and retention settings separately.
