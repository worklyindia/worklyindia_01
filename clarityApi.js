// clarityApi.js
import fetch from "node-fetch";

// SECURITY: Use environment variable for Clarity API token
// Set CLARITY_TOKEN in your environment variables
const CLARITY_TOKEN = process.env.CLARITY_TOKEN;

export async function getClarityData() {
  // Verify token is configured
  if (!CLARITY_TOKEN) {
    console.error("CLARITY_TOKEN environment variable is not set");
    return null;
  }

  try {
    const response = await fetch("https://api.clarity.ms/v1/data", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${CLARITY_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error(`Clarity API responded with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Clarity API Error:", error);
    return null;
  }
}
