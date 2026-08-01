import { parseAudioMessage } from "../utils";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("Running Audio Message Parsing Tests...");

// Test 1: New audio message with type 'audio' and fileUrl
const test1 = parseAudioMessage({
  type: "audio",
  fileUrl: "https://res.cloudinary.com/demo/chat-document/audio_123.ogg",
  message: "<<audio message>>",
});
assert(test1.isAudio === true, "Test 1: isAudio should be true");
assert(
  test1.audioUrl === "https://res.cloudinary.com/demo/chat-document/audio_123.ogg",
  "Test 1: audioUrl should match fileUrl"
);
assert(test1.displayText === null, "Test 1: displayText should be null");

// Test 2: Old broken audio message with <<audio message>> and embedded URL in message text
const test2 = parseAudioMessage({
  fileUrl: "",
  message:
    "<<audio message>>\nhttps://res.cloudinary.com/demo/chat-document/audio_456.ogg",
});
assert(test2.isAudio === true, "Test 2: isAudio should be true");
assert(
  test2.audioUrl === "https://res.cloudinary.com/demo/chat-document/audio_456.ogg",
  "Test 2: audioUrl should be extracted from text"
);
assert(test2.displayText === null, "Test 2: displayText should be null");

// Test 3: Audio message with no URL anywhere (corrupted/missing)
const test3 = parseAudioMessage({
  type: "audio",
  fileUrl: "",
  message: "<<audio message>>",
});
assert(test3.isAudio === true, "Test 3: isAudio should be true");
assert(test3.audioUrl === null, "Test 3: audioUrl should be null");
assert(test3.displayText === null, "Test 3: displayText should be null");

// Test 4: Regular text message
const test4 = parseAudioMessage({
  message: "Hello world!",
});
assert(test4.isAudio === false, "Test 4: isAudio should be false");
assert(test4.audioUrl === null, "Test 4: audioUrl should be null");
assert(test4.displayText === "Hello world!", "Test 4: displayText should match message");

console.log("✓ All audio message parsing tests passed successfully!");
