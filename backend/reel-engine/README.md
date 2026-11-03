# Reel test project
npm install
ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] node tts.mjs   # voice + word timings -> src/voice.json, public/voice/
node render.mjs video out                                        # out/reel.mp4 (1080x1920, H.264)
node render.mjs stills out 30,400                                 # preview frames
Without voice.json beats, captions use an estimated 2.7 words/sec and the reel is silent.
