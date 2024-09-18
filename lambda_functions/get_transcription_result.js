import { TranscribeClient, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const transcribeClient = new TranscribeClient();
const s3Client = new S3Client();

export const handler = async (event) => {
    const jobName = event.queryStringParameters.jobName;

    try {
        const job = await getTranscriptionResult(jobName);

        if (job.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
            const transcriptFileUri = job.TranscriptionJob.Transcript.TranscriptFileUri;
            const transcriptContent = await getTranscriptContent(transcriptFileUri);

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
                },
                body: JSON.stringify({
                    jobStatus: 'COMPLETED',
                    transcript: transcriptContent
                })
            };
        } else {
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
                },
                body: JSON.stringify({
                    jobStatus: 'IN_PROGRESS'
                })
            };
        }
    } catch (error) {
        console.error("Error: ", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};

const getTranscriptionResult = async (jobName) => {
    const params = {
        TranscriptionJobName: jobName,
    };
    const command = new GetTranscriptionJobCommand(params);
    return transcribeClient.send(command);
};

const getTranscriptContent = async (transcriptFileUri) => {
    const url = new URL(transcriptFileUri);
    
    
    const urlArray = url.pathname.split("/");
    const bucketName = urlArray[1];
    const key = urlArray[2];

    console.log("url:"+url+", bucketName:"+bucketName+",key:"+key);
    const params = {
        Bucket: bucketName,
        Key: key
    };
    
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    const stream = response.Body;
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf-8');
    const transcriptData = JSON.parse(body);

    return transcriptData;
};
