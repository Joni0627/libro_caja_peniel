import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeReceiptImage = async (base64Image: string) => {
  if (!process.env.API_KEY) {
    console.warn("API Key missing for Gemini");
    return null;
  }

  try {
    // Remove header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: "Analiza este recibo/factura y extrae los siguientes datos en formato JSON: fecha (YYYY-MM-DD), monto (numero), moneda (CLP, USD, o EUR, infiere la mas probable), y un detalle corto (descripcion). Si no encuentras algo, estima o deja vacio."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Fecha del movimiento en formato YYYY-MM-DD" },
            amount: { type: Type.NUMBER, description: "Monto total del movimiento" },
            currency: { type: Type.STRING, description: "Moneda detectada (CLP, USD, EUR)" },
            detail: { type: Type.STRING, description: "Breve descripción del item o servicio" }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);

  } catch (error) {
    console.error("Error analyzing receipt with Gemini:", error);
    throw error;
  }
};