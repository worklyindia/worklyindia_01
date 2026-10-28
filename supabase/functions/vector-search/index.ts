import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parseServiceAccountKey, getGoogleAccessToken, corsHeaders } from "../_shared/googleAuth.ts";
import { getOwnerSecretJson } from "../_shared/ownerSecrets.ts";

const VERTEX_AI_LOCATION = "us-central1";

interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

interface UpsertRequest {
  indexEndpoint: string;
  deployedIndexId: string;
  datapoints: Array<{
    datapoint_id: string;
    feature_vector: number[];
    restricts?: Array<{ namespace: string; allow_list?: string[]; deny_list?: string[] }>;
    crowding_tag?: { crowding_attribute: string };
  }>;
}

interface SearchRequest {
  indexEndpoint: string;
  deployedIndexId: string;
  query: number[] | string;
  neighborCount?: number;
  returnFullDatapoint?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Parse service account for Vector Search — Owner Secrets page Vector
    // Search API JSON first, then the Vertex AI API JSON, then the
    // Vertex_AI env secret as last fallback.
    let serviceAccount = await getOwnerSecretJson("GOOGLE_VECTOR_SEARCH_API_JSON");
    if (!serviceAccount) {
      serviceAccount = await getOwnerSecretJson("VERTEX_AI_API_JSON");
    }
    if (!serviceAccount) {
      const serviceAccountKey = Deno.env.get("Vertex_AI");
      if (!serviceAccountKey) {
        throw new Error("Vector Search service account not configured — save the Vector Search API JSON on the Owner Secrets page.");
      }
      serviceAccount = JSON.parse(serviceAccountKey);
    }
    const projectId = serviceAccount.project_id;

    console.log(`Vector Search request: ${path} for project: ${projectId}`);

    // Get access token with Vertex AI scope
    const accessToken = await getGoogleAccessToken(serviceAccount, [
      "https://www.googleapis.com/auth/cloud-platform"
    ]);

    let result;

    switch (path) {
      case "embed":
        result = await handleEmbed(req, accessToken, projectId);
        break;
      case "upsert":
        result = await handleUpsert(req, accessToken, projectId);
        break;
      case "search":
        result = await handleSearch(req, accessToken, projectId);
        break;
      case "health":
        result = { status: "ok", projectId, timestamp: new Date().toISOString() };
        break;
      default:
        return new Response(
          JSON.stringify({ 
            error: "Invalid endpoint", 
            availableEndpoints: ["embed", "upsert", "search", "health"] 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Vector Search error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, stack: errorStack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleEmbed(req: Request, accessToken: string, projectId: string) {
  const body: EmbeddingRequest = await req.json();
  const { texts, model = "text-embedding-004" } = body;

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new Error("texts array is required");
  }

  console.log(`Generating embeddings for ${texts.length} texts using ${model}`);

  // Use Vertex AI Embeddings API
  const embeddingUrl = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${model}:predict`;

  const instances = texts.map(text => ({ content: text }));

  const response = await fetch(embeddingUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding API error:", errorText);
    throw new Error(`Embedding API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Extract embeddings from response
  const embeddings = data.predictions?.map((pred: any) => pred.embeddings?.values || pred.values) || [];

  console.log(`Generated ${embeddings.length} embeddings`);

  return {
    success: true,
    embeddings,
    model,
    dimensions: embeddings[0]?.length || 0,
    count: embeddings.length
  };
}

async function handleUpsert(req: Request, accessToken: string, projectId: string) {
  const body: UpsertRequest = await req.json();
  const { indexEndpoint, deployedIndexId, datapoints } = body;

  if (!indexEndpoint || !deployedIndexId || !datapoints) {
    throw new Error("indexEndpoint, deployedIndexId, and datapoints are required");
  }

  console.log(`Upserting ${datapoints.length} vectors to ${deployedIndexId}`);

  // Upsert to Vector Search Index Endpoint
  const upsertUrl = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/${indexEndpoint}:upsertDatapoints`;

  const response = await fetch(upsertUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deployed_index_id: deployedIndexId,
      datapoints: datapoints.map(dp => ({
        datapoint_id: dp.datapoint_id,
        feature_vector: dp.feature_vector,
        restricts: dp.restricts,
        crowding_tag: dp.crowding_tag
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Upsert API error:", errorText);
    throw new Error(`Upsert API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Upsert successful");

  return {
    success: true,
    upsertedCount: datapoints.length,
    response: data
  };
}

async function handleSearch(req: Request, accessToken: string, projectId: string) {
  const body: SearchRequest = await req.json();
  const { indexEndpoint, deployedIndexId, query, neighborCount = 10, returnFullDatapoint = false } = body;

  if (!indexEndpoint || !deployedIndexId || !query) {
    throw new Error("indexEndpoint, deployedIndexId, and query are required");
  }

  let queryVector = query;

  // If query is a string, first convert to embedding
  if (typeof query === "string") {
    console.log("Converting query text to embedding...");
    
    const embeddingUrl = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/text-embedding-004:predict`;

    const embResponse = await fetch(embeddingUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [{ content: query }]
      })
    });

    if (!embResponse.ok) {
      const errorText = await embResponse.text();
      throw new Error(`Embedding failed: ${errorText}`);
    }

    const embData = await embResponse.json();
    queryVector = embData.predictions?.[0]?.embeddings?.values || embData.predictions?.[0]?.values;
    
    if (!queryVector) {
      throw new Error("Failed to generate query embedding");
    }
  }

  console.log(`Searching for ${neighborCount} neighbors in ${deployedIndexId}`);

  // Search the Vector Search Index
  const searchUrl = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/${indexEndpoint}:findNeighbors`;

  const response = await fetch(searchUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deployed_index_id: deployedIndexId,
      queries: [{
        datapoint: {
          feature_vector: queryVector
        },
        neighbor_count: neighborCount
      }],
      return_full_datapoint: returnFullDatapoint
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Search API error:", errorText);
    throw new Error(`Search API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const neighbors = data.nearestNeighbors?.[0]?.neighbors || [];

  console.log(`Found ${neighbors.length} neighbors`);

  return {
    success: true,
    results: neighbors.map((n: any) => ({
      id: n.datapoint?.datapoint_id,
      distance: n.distance,
      datapoint: returnFullDatapoint ? n.datapoint : undefined
    })),
    count: neighbors.length
  };
}
