
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, User, Bot, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface Message {
    role: 'user' | 'agent';
    text: string;
}

export default function VoiceInterface() {
    const [isRecording, setIsRecording] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('hi-IN');

    const languages = [
        { code: 'hi-IN', name: 'Hindi' },
        { code: 'en-IN', name: 'English' },
        { code: 'bn-IN', name: 'Bengali' },
        { code: 'gu-IN', name: 'Gujarati' },
        { code: 'kn-IN', name: 'Kannada' },
        { code: 'ml-IN', name: 'Malayalam' },
        { code: 'mr-IN', name: 'Marathi' },
        { code: 'od-IN', name: 'Odia' },
        { code: 'pa-IN', name: 'Punjabi' },
        { code: 'ta-IN', name: 'Tamil' },
        { code: 'te-IN', name: 'Telugu' },
    ];

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // or 'audio/webm' depending on browser
                await processAudio(audioBlob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Auto-stop after 25 seconds (Sarvam limit is 30s)
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    stopRecording();
                }
            }, 25000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setError("Could not access microphone. Please ensure permissions are granted.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const processAudio = async (audioBlob: Blob) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('language', selectedLanguage);

            const response = await axios.post('/api/chat', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const { userText, agentText, audioBase64 } = response.data;

            // Add messages to history
            setMessages(prev => [
                ...prev,
                { role: 'user', text: userText },
                { role: 'agent', text: agentText }
            ]);

            // Play audio response
            if (audioBase64) {
                playAudio(audioBase64);
            }

        } catch (err) {
            console.error("Error processing audio:", err);
            setError("Failed to process request. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const playAudio = (base64Audio: string) => {
        try {
            const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
            audio.play().catch(e => {
                console.error("Autoplay failed:", e);
                setError("Could not auto-play audio. Click the icon to retry.");
            });
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto p-4">

            <div className="mb-4 flex justify-end">
                <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={isRecording || isLoading}
                    className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                    {languages.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-50 rounded-lg min-h-[400px]">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-20">
                        <p className="text-lg">Tap microphone to start talking</p>
                        <p className="text-sm">I'm here to listen.</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-start max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`p-2 rounded-full mx-2 ${msg.role === 'user' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                {msg.role === 'user' ? <User size={20} className="text-blue-600" /> : <Bot size={20} className="text-green-600" />}
                            </div>
                            <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex items-start max-w-[80%]">
                            <div className="p-2 rounded-full mx-2 bg-green-100">
                                <RefreshCw size={20} className="text-green-600 animate-spin" />
                            </div>
                            <div className="p-3 rounded-lg bg-gray-100 text-gray-500 italic">
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center py-6">
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading}
                    className={`p-6 rounded-full transition-all duration-300 shadow-lg ${isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : isLoading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                        }`}
                >
                    {isRecording ? (
                        <MicOff size={32} className="text-white" />
                    ) : (
                        <Mic size={32} className="text-white" />
                    )}
                </button>
            </div>
            <p className="text-center text-gray-400 text-xs">
                {isRecording ? 'Listening... (Max 25s)' : isLoading ? 'Processing...' : 'Tap to Speak'}
            </p>
        </div>
    );
}
