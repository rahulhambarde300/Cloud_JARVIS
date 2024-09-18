import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const s3Client = new S3Client({ region: 'us-east-1' });
const transcribeClient = new TranscribeClient({ region: 'us-east-1' });

export const handler = async (event) => {
  const bucketName = 'jarvis-transcriptions';
  const fileName = 'jarvis-transcription-file' + Date.now();
  const jobName = 'jarvis-transcription' + Date.now();
  const { fileContent } = JSON.parse(event.body);
  const fileCont = Buffer.from(fileContent, 'base64');

  try {
    await uploadAudioFileToS3(bucketName, fileName, fileCont);
    await startTranscription(bucketName, fileName, jobName);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: JSON.stringify({ message: 'Transcription job started', jobName }),
    };
  } catch (error) {
    console.error('Error occurred:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const uploadAudioFileToS3 = async (bucketName, fileName, fileContent) => {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);
  return s3Client.send(command);
};

const startTranscription = (bucketName, fileName, jobName) => {
  const params = {
    TranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    Media: {
      MediaFileUri: `s3://${bucketName}/${fileName}`,
    },
    OutputBucketName: bucketName,
  };

  const command = new StartTranscriptionJobCommand(params);
  return transcribeClient.send(command);
};
