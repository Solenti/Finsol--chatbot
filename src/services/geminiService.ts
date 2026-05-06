import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as XLSX from 'xlsx';

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function analyzeAccountingFile(file: File, prompt: string) {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
  }
  
  try {
    const mimeType = file.type;
    const isExcel = mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                    mimeType === "application/vnd.ms-excel" ||
                    file.name.endsWith(".xlsx") || 
                    file.name.endsWith(".xls");
    const isCSV = mimeType === "text/csv" || file.name.endsWith(".csv");

    let parts: any[] = [];

    if (isExcel || isCSV) {
      // Parse Excel/CSV to text
      const data = await fileToExcelText(file);
      parts.push({
        text: `Here is the content of the uploaded spreadsheet/CSV file:\n\n${data}\n\n`
      });
    } else {
      // Handle as inlineData (PDF, Images, etc.)
      const base64Data = await fileToBase64(file);
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType || "application/pdf", // Default to PDF if unknown
        },
      });
    }

    const instructionPart = {
      text: `
      You are a professional senior accountant and financial analyst. 
      Analyze the provided accounting/financial data based on the user's request: "${prompt}"
      
      Provide your response in a structured JSON format with the following fields:
      {
        "summary": "A short Summary of the document",
        "insights": ["List of ALL important financial insights, observations, and detailed analysis points."],
        "metrics": [
          {"label": "Metric Name", "value": "Value", "trend": "up | down | neutral", "change": "e.g., +15.2%"}
        ],
        "detailedTable": [
          {"head": "Category/Item", "value": "Amount/Value", "note": "Brief context or variance"}
        ],
        "review": "Key observation of the uploaded File or any anomalies/recommendations"
      }
      
      The 'detailedTable' should contain the most important line items found in the document presented in a tabular format.
      Ensure the metrics array has exactly 4 key metrics.
      Include the percentage change for each metric if it can be calculated or inferred from historical data in the document.
      If the data is not related to accounting, explain that in the summary and return empty arrays/strings for other fields.
      Return ONLY the JSON.
      `
    };

    parts.push(instructionPart);

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts }],
    });

    const text = response.text || "";
    
    // Clean the response text (remove markdown code blocks if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

async function fileToExcelText(file: File): Promise<string> {
  const MAX_CHARS = 2000000; // Roughly 500k-700k tokens, well within 1M limit
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        let fullText = "";
        let isTruncated = false;
        
        for (const sheetName of workbook.SheetNames) {
          if (fullText.length >= MAX_CHARS) {
            isTruncated = true;
            break;
          }
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          const sheetText = `### Sheet: ${sheetName}\n${csv}\n\n`;
          
          if (fullText.length + sheetText.length > MAX_CHARS) {
            fullText += sheetText.substring(0, MAX_CHARS - fullText.length);
            isTruncated = true;
            break;
          } else {
            fullText += sheetText;
          }
        }
        
        if (isTruncated) {
          fullText += "\n\n[NOTICE: The file content was truncated because it exceeded the maximum allowed size for analysis. Please ask for specific parts if needed.]";
        }
        
        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove the data:mime/type;base64, prefix
      resolve(base64String.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}
