require('dotenv').config();
const express = require('express');
const { twiml } = require('twilio');
const OpenAI = require('openai');
const fs = require('fs');
const { jamieResumePrompt } = require('./prompts')

const app = express();
const port = 3000;


// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.urlencoded({ extended: true }));

// Define the system prompt with resume content
const systemPrompt = jamieResumePrompt;

// Handle incoming call
app.post('/incoming-call', (req, res) => {
    const response = new twiml.VoiceResponse();

    // Greeting
    response.say(
        { voice: 'Polly.Matthew-Neural', language: 'en-GB' },
        `Hello! Thank you for calling. I’m here to tell you why Jamie would be a great hire at CloneOps. 
        Please ask me anything you'd like to know about Jamie. 
        Note that you can end this call at any time by saying, 'end call'`
    );

    // Gather speech input
    response.gather({
        input: 'speech',
        timeout: 8,
        speechTimeout: 'auto',
        action: '/process-call',
        method: 'POST'
    });

    res.type('text/xml');
    res.send(response.toString());
});

// Handle speech input
app.post('/process-call', async (req, res) => {
    const userSpeech = req.body.SpeechResult?.toLowerCase() || '';

    // Use OpenAI to generate a response based on the resume context and user's input
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userSpeech }
        ]
    });

    const aiResponse = completion.choices[0].message.content.trim();

    // Create a response for the caller
    const voiceResponse = new twiml.VoiceResponse();

    // End the call if the user says "no" or "end call"
    if (userSpeech.includes('end call')) {
        voiceResponse.say({ voice: 'Polly.Matthew-Neural', language: 'en-GB' }, "Okay, thank you for using Jamie's virtual phone assistant, have a nice day.");
        voiceResponse.hangup();
        res.type('text/xml');
        return res.send(voiceResponse.toString());
    }

    // Let Twilio speak the AI response
    voiceResponse.say({ voice: 'Polly.Matthew-Neural', language: 'en-GB' }, aiResponse);

    // Ask if they want to ask anything else
    voiceResponse.say({ voice: 'Polly.Matthew-Neural', language: 'en-GB' }, "Would you like to ask anything else about Jamie's qualifications or background?");

    // Gather the next speech input from the caller
    voiceResponse.gather({
        input: 'speech',
        timeout: 8,
        speechTimeout: 'auto',
        action: '/process-call',
        method: 'POST'
    });

    res.type('text/xml');
    res.send(voiceResponse.toString());
});




// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
