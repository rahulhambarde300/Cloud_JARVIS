import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const pollyClient = new PollyClient({ region: "us-east-1" });

export const handler = async (event) => {
  try {
    const {text} = JSON.parse(event.body);
    const textMsg = text || "Hello, this is a test message from AWS Polly.";

    const params = {
      Text: textMsg,
      OutputFormat: "mp3",
      VoiceId: "Joanna",
    };

    const command = new SynthesizeSpeechCommand(params);
    const response = await pollyClient.send(command);

    const audioStream = response.AudioStream;
    let audioChunks = [];
    for await (const chunk of audioStream) {
      audioChunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(audioChunks);
    const base64Audio = audioBuffer.toString("base64");;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
      body: JSON.stringify({
        message: "Speech synthesis successful.",
        audio: base64Audio,
      }),
    };
  } catch (error) {
    console.error("Error while synthesizing speech:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
      body: JSON.stringify({
        message: "Error while synthesizing speech.",
        error: error.message,
      }),
    };
  }
};
