Saraswati Stories — Audio Folder

This folder contains 12 placeholder WAV files (2 seconds of silence each) so your app has a valid structure:

assets/audio/
  - ep01-born-from-the-first-breath.wav
  - ep02-i-am-the-queen.wav
  - ep03-river-of-thunder.wav
  - ep04-invisible-third.wav
  - ep05-pushkar-and-the-curse.wav
  - ep06-kalidasa-blessing.wav
  - ep07-throne-of-wisdom.wav
  - ep08-veena-across-the-sea.wav
  - ep09-first-letters-on-rice.wav
  - ep10-vanished-river.wav
  - ep11-co-wives-of-the-cosmos.wav
  - ep12-the-swan-of-clarity.wav

They are SILENT placeholders. Replace each with your narrated audio, or convert them to MP3.

Quick ways to generate real audio from text:

1) gTTS (Google Text-to-Speech, outputs MP3)
   - pip install gTTS
   - python - <<'PY'
from gtts import gTTS
text = "Born From the First Breath: Brahma’s breath gives form to Saraswati."
gTTS(text=text, lang='en').save('assets/audio/ep01-born-from-the-first-breath.mp3')
PY

2) Azure Speech (Text to Speech)
   - Use the SDK/CLI/REST to synthesize to WAV/MP3, then place outputs into assets/audio.
   - Docs: https://learn.microsoft.com/azure/ai-services/speech-service/index-text-to-speech

3) AWS Polly
   - Use Polly to synthesize text to MP3, then save into assets/audio.
   - Docs: https://docs.aws.amazon.com/polly/

If you keep WAV files but want MP3 for browser compatibility/size, convert with FFmpeg:
  ffmpeg -i input.wav -codec:a libmp3lame -qscale:a 2 output.mp3

If your filenames differ, update your stories.html playlist paths accordingly, or replace our placeholder names.

Also included: playlist.json
  - Shape: {"stories": {"episodes": [{id, title, desc, audio}]}}
  - You can load this into window.I18N.data to drive the dynamic playlist.
