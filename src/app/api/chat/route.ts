
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File | null;
        let userText = formData.get('text') as string | null;
        let detectedLanguage = 'en-IN'; // Default language


        if (!process.env.SARVAM_API_KEY || !process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
        }

        // 1. Speech to Text (if audio provided)
        if (audioFile) {
            const sttFormData = new FormData();
            sttFormData.append('file', audioFile);
            sttFormData.append('model', 'saarika:v2.5'); // Updated to valid model for speech-to-text endpoint

            // Note: Native FormData in Node environment for Axios might need manual headers or formatting
            // But Next.js Edge/Node runtime handles native FormData reasonably well in recent versions
            // verifying handling: we might need to convert File to Blob or Buffer for backend-to-backend

            const arrayBuffer = await audioFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Re-constructing for axios (using 'form-data' compatible structure if needed, but let's try direct)
            // Actually, for robust backend-to-backend file upload, it's safer to use a custom boundary or standard fetch

            const sarvamFormData = new FormData();
            sarvamFormData.append('file', new Blob([buffer], { type: audioFile.type }), 'audio.wav');
            sarvamFormData.append('model', 'saarika:v2.5');

            const sttResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
                method: 'POST',
                headers: {
                    'api-subscription-key': process.env.SARVAM_API_KEY,
                },
                body: sarvamFormData,
            });

            if (!sttResponse.ok) {
                const errorText = await sttResponse.text();
                console.error("Sarvam STT Error:", errorText);
                return NextResponse.json({ error: `Sarvam STT Failed: ${errorText}` }, { status: sttResponse.status });
            }

            const sttData = await sttResponse.json();
            userText = sttData.transcript;
            detectedLanguage = sttData.language_code || 'en-IN';
        }

        if (!userText) {
            return NextResponse.json({ error: 'No input provided' }, { status: 400 });
        }

        // 2. LLM Processing (Groq)
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a compassionate, empathetic mental health support assistant. Your name is Serenity. Listen carefully to the user, validate their feelings, and offer gentle support. Keep responses concise, warm, and conversational. Do not provide medical diagnosis. If the user seems in danger, advise them to seek professional help. IMPORTANT: Always reply in the same language as the user.'
                },
                {
                    role: 'user',
                    content: userText,
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 150,
        });

        const agentText = chatCompletion.choices[0]?.message?.content || "I'm listening. Please go on.";

        // 3. Text to Speech (Sarvam)
        // Adjust endpoint and payload based on Sarvam docs
        const ttsResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': process.env.SARVAM_API_KEY,
            },
            body: JSON.stringify({
                inputs: [agentText],
                target_language_code: detectedLanguage,
                speaker: 'anushka'
            }),
        });

        let audioBase64 = null;
        if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json();
            // Sarvam usually returns audio content as base64 in 'audios' array
            audioBase64 = ttsData.audios?.[0] || null;
        } else {
            console.error("Sarvam TTS Error:", await ttsResponse.text());
            // We continue without audio if TTS fails, just return text
        }

        return NextResponse.json({
            userText,
            agentText,
            audioBase64
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
