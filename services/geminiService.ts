
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper function for exponential backoff retry
async function fetchWithRetry(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes('429') || error.message?.includes('quota'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const geminiService = {
  async generateTopics(program: string, level: string, lang: string) {
    return fetchWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate 12 diverse and interesting vocabulary topics for ${program} at level ${level}. 
        Return as a JSON array of objects with id, title, and count. 
        Output titles and descriptions in ${lang === 'VN' ? 'Vietnamese' : lang === 'KR' ? 'Korean' : 'English'}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                count: { type: Type.NUMBER }
              },
              required: ['id', 'title', 'count']
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    });
  },

  async generateWordsForTopic(topic: string, program: string, lang: string) {
    return fetchWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate 5-8 English words for the topic "${topic}" in ${program} context. 
        For each word include: word, wordType (e.g., noun, verb, adj), ipa, meaning (in ${lang === 'VN' ? 'Vietnamese' : lang === 'KR' ? 'Korean' : 'English'}), 
        alternativeMeanings (array of other meanings), usage, synonyms, antonyms, and an example sentence.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                word: { type: Type.STRING },
                wordType: { type: Type.STRING },
                ipa: { type: Type.STRING },
                meaning: { type: Type.STRING },
                alternativeMeanings: { type: Type.ARRAY, items: { type: Type.STRING } },
                usage: { type: Type.STRING },
                synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                example: { type: Type.STRING }
              },
              required: ['id', 'word', 'wordType', 'ipa', 'meaning', 'usage', 'synonyms', 'antonyms', 'example']
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    });
  },

  async lookupWord(query: string, lang: string) {
    return fetchWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as "Peri", a cute, energetic space explorer and language teacher robot. Look up the word/phrase: "${query}".
        Provide a highly detailed, engaging dictionary result in ${lang === 'VN' ? 'Vietnamese' : 'English'}. 
        Use a friendly "space adventure" tone.
        
        Structure:
        - introMessage: A welcoming message from Peri like "Bíp bíp! Peri chào bạn nhé! Hôm nay chúng mình cùng khám phá từ '...' này nha..."
        - word: The word in original language
        - transliteration: Phonetic reading
        - wordType: Part of speech
        - ipa: IPA
        - meaning: definition
        - illustrationPrompt: a specific prompt for AI image generation (cute robot character like Peri, astronaut style, representing the word's meaning)
        - tips: array of exactly 2 objects (icon, title, content, bgClass)
        - examples: array of 3 objects (contextTitle, original, transliteration, translated)
        
        Output in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              introMessage: { type: Type.STRING },
              word: { type: Type.STRING },
              transliteration: { type: Type.STRING },
              wordType: { type: Type.STRING },
              ipa: { type: Type.STRING },
              meaning: { type: Type.STRING },
              tips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    icon: { type: Type.STRING },
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    bgClass: { type: Type.STRING }
                  }
                }
              },
              examples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    contextTitle: { type: Type.STRING },
                    original: { type: Type.STRING },
                    translated: { type: Type.STRING }
                  }
                }
              },
              illustrationPrompt: { type: Type.STRING }
            },
            required: ['word', 'meaning', 'introMessage', 'tips', 'examples', 'illustrationPrompt']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    });
  },

  async generateIllustration(word: string, meaning: string, customPrompt?: string) {
    const finalPrompt = customPrompt || `A bright, high-quality 3D render illustration in Pixar/Duolingo style representing "${word}" (${meaning}). Simple background, vibrant colors.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: finalPrompt }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  },

  async generateSpeech(text: string) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  },

  async generateReadingPassages(lang: string) {
    return fetchWithRetry(async () => {
      // Changed to flash-preview for higher quota
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate exactly 25 diverse and high-quality IELTS reading passage headers. 
        Topics should range from Science, History, Tech, Art, to Social Issues.
        For each, provide: id, title, category (in ${lang === 'VN' ? 'Vietnamese' : 'English'}), and a short teaser.
        Return as a JSON array.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                teaser: { type: Type.STRING }
              },
              required: ['id', 'title', 'category', 'teaser']
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    });
  },

  async getPassageDetail(title: string, lang: string) {
    return fetchWithRetry(async () => {
      // Changed to flash-preview for higher quota
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a full IELTS-style reading passage titled "${title}". 
        Length: approx 600-800 words, academic tone, divided into 5-7 clear paragraphs.
        Also provide 12 clean, single-word vocabulary items from the text with wordType, IPA, and meaning in ${lang === 'VN' ? 'Vietnamese' : 'English'}.
        Return as JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    wordType: { type: Type.STRING },
                    ipa: { type: Type.STRING },
                    meaning: { type: Type.STRING }
                  },
                  required: ['word', 'wordType', 'ipa', 'meaning']
                }
              }
            },
            required: ['title', 'content', 'vocabulary']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    });
  }
};
