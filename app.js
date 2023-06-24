const express = require("express");
const app = express();
const { Writable } = require("stream");
const recorder = require("node-record-lpcm16");
const speech = require("@google-cloud/speech").v1p1beta1;
const configFile = require('./config.json');

const client = new speech.SpeechClient({
  projectId: configFile.google.projectId,
  keyFilename: configFile.google.keyFilename,
});

const config = {
  encoding: "LINEAR16",
  sampleRateHertz: 16000,
  languageCode: "en-US",
};

app.use(express.json());

app.post("/api/voice-to-text", (req, res) => {
    
  const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
      audioInput.push(chunk);
      next();
    },
    final() {
      if (recognizeStream) {
        recognizeStream.end();
      }
    },
  });

  const audioInput = [];
  let recognizeStream = null;

  const request = {
    config,
    interimResults: true,
  };

  const speechCallback = (stream) => {
    if (stream.results[0] && stream.results[0].alternatives[0]) {
      const transcript = stream.results[0].alternatives[0].transcript;
      res.write(`\n${transcript}`);
    }
  };

  const startStream = () => {
    audioInput.length = 0;
    recognizeStream = client
      .streamingRecognize(request)
      .on("error", (err) => {
        console.error("API request error " + err);
      })
      .on("data", speechCallback);
  };

  // Start recording and send the microphone input to the Speech API
  recorder
    .record({
      sampleRateHertz: config.sampleRateHertz,
      threshold: 0, // Silence threshold
      silence: 1000,
      keepSilence: true,
      recordProgram: "rec", // Try also "arecord" or "sox"
    })
    .stream()
    .on("error", (err) => {
      console.error("Audio recording error " + err);
    })
    .pipe(audioInputStreamTransform);

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  res.write("Listening, press Ctrl+C to stop.\n\n");
  res.write("End (ms)       Transcript Results/Status\n");
  res.write("=========================================================\n");

  startStream();
});

app.listen(3002, () => {
  console.log("Server is running on port 3002");
});
