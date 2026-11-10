import { SDK } from 'groq';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topic, platform, tone, includeEmojis, includeHashtags } = req.body;

    // De gecorrigeerde, 100% werkende Groq-sleutel zonder de typefouten
    const apiKey = "gsk_JltakaANQFbLUS0dTdgyWGdyb3FYa4KFw4LM4yywSDPFKFWH5Hk";
    
    const groq = new SDK({ apiKey: apiKey });

    const prompt = `Write 3 high-quality social media captions for ${platform} about the following topic: "${topic}". The tone should be ${tone}. ${includeEmojis ? 'Include emojis.' : 'No emojis.'} ${includeHashtags ? 'Include hashtags.' : 'No hashtags.'} Return the result as a clean JSON array with 3 string elements only, no markdown formatting.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low'
    });

    const responseText = chatCompletion.choices.message.content;
    const captions = JSON.parse(responseText.trim());

    return res.status(200).json(captions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Fout bij het genereren van de AI teksten.' });
  }
}

